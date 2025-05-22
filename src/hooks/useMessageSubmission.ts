// src/hooks/useMessageSubmission.ts
import { useState, useRef, useEffect } from 'react';
import { useConversations } from '../contexts/ConversationContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useMemories } from '../contexts/MemoryContext';
import {
    streamMessageToGemini,
    type StreamedGeminiResponseChunk,
    type RawFileAttachment
} from '../services/geminiService';
import type { MessageMetadata, AttachedFileInfo, ProcessingStatus, Part, Conversation } from '../types';
import { systemMessage } from '../prompts';
import type { LocalAttachedFile } from './useFileAttachments';

interface UseMessageSubmissionProps {
    activeConversationId: string | null;
    conversations: Conversation[];
    text: string;
    attachedFiles: LocalAttachedFile[];
    isWebSearchEnabledForNextMessage: boolean;
    onSubmissionStart?: () => void; // Callback for clearing text, attachments, etc.
    onSubmissionEnd?: (options: { focusTextarea?: boolean, errorOccurred?: boolean }) => void; // Callback for focusing textarea, etc.
}

export function useMessageSubmission({
    activeConversationId,
    conversations,
    text,
    attachedFiles,
    isWebSearchEnabledForNextMessage,
    onSubmissionStart,
    onSubmissionEnd,
}: UseMessageSubmissionProps) {
    const {
        addMessageToConversation,
        updateMessageInConversation,
        abortEditedMessageResponse, // Keep this if MessageInput still handles edited messages
        isProcessingEditedMessage,  // Keep this
    } = useConversations();
    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);

    const abortStreamControllerRef = useRef<AbortController | null>(null);
    const lastProcessingStatusForInputRef = useRef<ProcessingStatus | null>(null);
    const accumulatedRawPartsForInputRef = useRef<Part[]>([]);

    const handleSubmit = async () => {
        setErrorFromAI(null);
        const trimmedText = text.trim();
        const hasFilesToSend = (settings.enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) && attachedFiles.length > 0;
        const hasContentToSend = trimmedText || hasFilesToSend;

        if (!hasContentToSend || !activeConversationId || isProcessingEditedMessage) {
            if (isLoadingAI) return;
            return;
        }

        if (!settings.apiKey) {
            addMessageToConversation(activeConversationId, {
                text: "Erro: Chave de API não configurada.", sender: 'model', metadata: { error: true }
            });
            onSubmissionStart?.(); // Clear text, attachments
            onSubmissionEnd?.({ focusTextarea: false });
            return;
        }

        if (abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("New submission started");
        }
        abortStreamControllerRef.current = new AbortController();
        const signal = abortStreamControllerRef.current.signal;

        onSubmissionStart?.(); // Clear text, attachments, etc.
        setIsLoadingAI(true);

        lastProcessingStatusForInputRef.current = null;
        accumulatedRawPartsForInputRef.current = [];
        let accumulatedAiText = "";

        const currentTextForAI = trimmedText;
        const currentConversation = conversations.find(c => c.id === activeConversationId);
        const webSearchActiveForThisSubmission = settings.enableWebSearch && isWebSearchEnabledForNextMessage;
        // Note: Toggling isWebSearchEnabledForNextMessage back to false should be handled by the parent component

        const historyBeforeCurrentUserMessage: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[] =
            currentConversation?.messages.map(msg => {
                if (msg.metadata?.rawParts) {
                    return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                }
                return { sender: msg.sender, text: msg.text };
            }) || [];

        const filesInfoForUIMessage: AttachedFileInfo[] = attachedFiles
            .filter(localFile => settings.enableAttachments || localFile.file.type.startsWith('audio/'))
            .map(localFile => ({
                id: localFile.id,
                name: localFile.name,
                type: localFile.type,
                size: localFile.size,
                dataUrl: localFile.previewUrl,
            }));

        addMessageToConversation(activeConversationId, {
            text: trimmedText,
            sender: 'user',
            metadata: {
                attachedFilesInfo: filesInfoForUIMessage.length > 0 ? filesInfoForUIMessage : undefined
            }
        });

        const filesToSendToAI = attachedFiles.filter(localFile => settings.enableAttachments || localFile.file.type.startsWith('audio/'));
        
        const aiMessageId = addMessageToConversation(activeConversationId, {
            text: "", sender: 'model', metadata: { isLoading: true }
        });
        if (!aiMessageId) {
            console.error("Não foi possível criar a mensagem placeholder da IA.");
            setIsLoadingAI(false);
            onSubmissionEnd?.({ focusTextarea: true, errorOccurred: true });
            return;
        }

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;

        try {
            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));
            const rawFilesForAPI: RawFileAttachment[] = filesToSendToAI.map(localFile => ({ file: localFile.file }));
            const systemInstructionText = systemMessage({
                conversationTitle: currentConversation?.title,
                messageCountInConversation: currentConversation?.messages.length,
                customPersonalityPrompt: settings.customPersonalityPrompt
            });

            const streamGenerator = streamMessageToGemini(
                settings.apiKey, historyBeforeCurrentUserMessage, currentTextForAI, rawFilesForAPI,
                currentGlobalMemoriesWithObjects, settings.geminiModelConfig, systemInstructionText,
                settings.functionDeclarations || [], signal,
                webSearchActiveForThisSubmission
            );

            for await (const streamResponse of streamGenerator) {
                if (signal.aborted) { streamError = "Resposta abortada pelo usuário."; break; }

                if (streamResponse.delta) {
                    accumulatedAiText += streamResponse.delta;
                }
                if (streamResponse.processingStatus) {
                    lastProcessingStatusForInputRef.current = streamResponse.processingStatus;
                }
                if (streamResponse.rawPartsForNextTurn) {
                    accumulatedRawPartsForInputRef.current = [...streamResponse.rawPartsForNextTurn];
                }

                const showTypingCursor = !streamResponse.isFinished &&
                    !(lastProcessingStatusForInputRef.current &&
                        (lastProcessingStatusForInputRef.current.stage === 'pending' ||
                            lastProcessingStatusForInputRef.current.stage === 'in_progress' ||
                            lastProcessingStatusForInputRef.current.stage === 'awaiting_ai'));

                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: accumulatedAiText + (showTypingCursor ? "▍" : ""),
                    metadata: {
                        isLoading: !streamResponse.isFinished,
                        processingStatus: lastProcessingStatusForInputRef.current || undefined,
                        rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
                    }
                });

                if (streamResponse.error) {
                    streamError = streamResponse.error;
                }
                if (streamResponse.isFinished) {
                    accumulatedAiText = streamResponse.finalText || accumulatedAiText.replace(/▍$/, '');
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }

            const finalMetadata: Partial<MessageMetadata> = {
                isLoading: false,
                abortedByUser: streamError === "Resposta abortada pelo usuário." || (signal.aborted && !streamError) ? true : undefined,
                processingStatus: lastProcessingStatusForInputRef.current || undefined,
                rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
            };

            if (streamError && !finalMetadata.abortedByUser) {
                finalMetadata.error = streamError;
                finalMetadata.userFacingError = streamError;
                if (lastProcessingStatusForInputRef.current && lastProcessingStatusForInputRef.current.stage !== 'completed' && lastProcessingStatusForInputRef.current.stage !== 'failed') {
                    finalMetadata.processingStatus = { ...(lastProcessingStatusForInputRef.current || {} as ProcessingStatus), stage: 'failed', error: streamError };
                }
            }

            if (!streamError || finalMetadata.abortedByUser) {
                const processedMemoryActions: Required<MessageMetadata>['memorizedMemoryActions'] = [];
                if (memoryOperationsFromServer && memoryOperationsFromServer.length > 0) {
                    memoryOperationsFromServer.forEach(op => {
                        if (op.action === 'create' && op.content) {
                            const newMemoryObject = addMemory(op.content);
                            if (newMemoryObject) {
                                processedMemoryActions.push({ id: newMemoryObject.id, content: newMemoryObject.content, action: 'created' });
                            }
                        } else if (op.action === 'update' && op.targetMemoryContent && op.content) {
                            const memoryToUpdate = globalMemoriesFromHook.find(mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase());
                            if (memoryToUpdate) {
                                updateMemory(memoryToUpdate.id, op.content);
                                processedMemoryActions.push({ id: memoryToUpdate.id, content: op.content, originalContent: memoryToUpdate.content, action: 'updated' });
                            } else {
                                const newMemoryObject = addMemory(op.content); // If target not found, create new
                                if (newMemoryObject) {
                                    processedMemoryActions.push({ id: newMemoryObject.id, content: newMemoryObject.content, action: 'created' });
                                }
                            }
                        } else if (op.action === 'delete_by_ai_suggestion' && op.targetMemoryContent) {
                            const memoryToDelete = globalMemoriesFromHook.find(mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase());
                            if (memoryToDelete) {
                                deleteMemoryFromHook(memoryToDelete.id);
                                processedMemoryActions.push({ id: memoryToDelete.id, content: memoryToDelete.content, originalContent: memoryToDelete.content, action: 'deleted_by_ai' });
                            }
                        }
                    });
                    if (processedMemoryActions.length > 0) {
                        finalMetadata.memorizedMemoryActions = processedMemoryActions;
                    }
                }
            }

            const finalDisplayableText = accumulatedAiText;
            updateMessageInConversation(activeConversationId, aiMessageId, {
                text: finalDisplayableText, metadata: finalMetadata
            });

        } catch (error: unknown) {
            console.error("Falha catastrófica ao processar stream com Gemini:", error);
            const finalMetadataUpdate: Partial<MessageMetadata> = {
                isLoading: false,
                processingStatus: lastProcessingStatusForInputRef.current || undefined,
                rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
            };
            if ((error as Error).name === 'AbortError' || signal.aborted) {
                finalMetadataUpdate.abortedByUser = true; finalMetadataUpdate.error = false;
            } else {
                const clientErrorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu uma falha desconhecida no processamento da resposta.";
                finalMetadataUpdate.error = clientErrorMessage;
                finalMetadataUpdate.userFacingError = clientErrorMessage;
                setErrorFromAI(clientErrorMessage); // Set local error state for the input
            }
            updateMessageInConversation(activeConversationId, aiMessageId, {
                text: accumulatedAiText.replace(/▍$/, ''), metadata: finalMetadataUpdate
            });
        } finally {
            setIsLoadingAI(false);
            if (abortStreamControllerRef.current && abortStreamControllerRef.current.signal === signal) {
                abortStreamControllerRef.current = null;
            }
            lastProcessingStatusForInputRef.current = null;
            accumulatedRawPartsForInputRef.current = [];
            onSubmissionEnd?.({ focusTextarea: !errorFromAI && !streamError, errorOccurred: !!errorFromAI || !!streamError });
        }
    };

    const handleAbortAIResponse = () => {
        if (isLoadingAI && abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("User aborted direct stream");
            // The stream loop and finally block in handleSubmit will handle state updates
        } else if (isProcessingEditedMessage) { // This part might be specific to MessageInput's direct handling
            abortEditedMessageResponse();
        }
        onSubmissionEnd?.({ focusTextarea: true });
    };
    
    // Cleanup abort controller on unmount
    useEffect(() => {
        return () => {
            if (abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
                abortStreamControllerRef.current.abort("Component unmounting");
            }
        };
    }, []);

    return {
        isLoadingAI,
        errorFromAI,
        setErrorFromAI, // To clear error from parent
        handleSubmit,
        handleAbortAIResponse,
        isProcessingEditedMessage // Expose this for UI logic in parent
    };
}
