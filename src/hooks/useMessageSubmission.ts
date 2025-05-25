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
    onSubmissionStart?: () => void;
    onSubmissionEnd?: (options: { focusTextarea?: boolean, errorOccurred?: boolean }) => void;
    messageToEditId?: string;
}

export function useMessageSubmission({
    activeConversationId,
    conversations,
    text,
    attachedFiles,
    isWebSearchEnabledForNextMessage,
    onSubmissionStart,
    onSubmissionEnd,
    messageToEditId,
}: UseMessageSubmissionProps) {
    const {
        addMessageToConversation,
        updateMessageInConversation,
        removeMessagesAfterId,
    } = useConversations();
    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);

    const abortStreamControllerRef = useRef<AbortController | null>(null);
    const lastProcessingStatusForInputRef = useRef<ProcessingStatus | null>(null);
    const accumulatedRawPartsForInputRef = useRef<Part[]>([]);
    const accumulatedAttachedFilesInfoRef = useRef<AttachedFileInfo[]>([]);

    const handleSubmit = async () => {
        setErrorFromAI(null);
        const trimmedText = text.trim();
        const hasFilesToSend = (settings.enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) && attachedFiles.length > 0;
        const hasContentToSend = trimmedText || hasFilesToSend;

        if (!activeConversationId || isLoadingAI || (!messageToEditId && !hasContentToSend)) {
            return;
        }

        if (!settings.apiKey) {
            addMessageToConversation(activeConversationId, {
                text: "Erro: Chave de API não configurada.", sender: 'model', metadata: { error: true }
            });
            onSubmissionStart?.();
            onSubmissionEnd?.({ focusTextarea: false, errorOccurred: true });
            return;
        }

        if (abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("New submission started");
        }
        abortStreamControllerRef.current = new AbortController();
        const signal = abortStreamControllerRef.current.signal;

        onSubmissionStart?.();
        setIsLoadingAI(true);

        lastProcessingStatusForInputRef.current = null;
        accumulatedRawPartsForInputRef.current = [];
        accumulatedAttachedFilesInfoRef.current = [];
        let accumulatedAiText = "";

        const currentConversation = conversations.find(c => c.id === activeConversationId);
        if (!currentConversation) {
            console.error("Active conversation not found for submission.");
            setIsLoadingAI(false);
            onSubmissionEnd?.({ focusTextarea: true, errorOccurred: true });
            return;
        }

        const webSearchActiveForThisSubmission = settings.enableWebSearch && isWebSearchEnabledForNextMessage;

        // filesInfoForUIMessage includes all files (placeholders from edit and new ones)
        // to correctly update the user message metadata in the UI.
        const filesInfoForUIMessage: AttachedFileInfo[] = attachedFiles
            .filter(localFile => settings.enableAttachments || localFile.file.type.startsWith('audio/'))
            .map(localFile => ({
                id: localFile.id,
                name: localFile.name,
                type: localFile.type,
                size: localFile.size,
                dataUrl: localFile.previewUrl,
            }));

        // filesToSendToAI includes only new files (not placeholders) for the API call.
        const filesToSendToAI: LocalAttachedFile[] = attachedFiles.filter(localFile =>
            (settings.enableAttachments || localFile.file.type.startsWith('audio/')) &&
            !localFile.isPlaceholder && localFile.file && localFile.file.size > 0
        );

        let historyForAPI: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[];
        let textForAI: string = trimmedText;
        let aiMessageIdToStreamTo: string | null = null;
        let userMessageIdForHistory: string | null = null;


        if (messageToEditId) {
            // --- Editing existing user message ---
            const messageIndex = currentConversation.messages.findIndex(msg => msg.id === messageToEditId);
            if (messageIndex === -1 || currentConversation.messages[messageIndex].sender !== 'user') {
                console.error("Message to edit not found or is not a user message.");
                setIsLoadingAI(false);
                onSubmissionEnd?.({ focusTextarea: true, errorOccurred: true });
                return;
            }
            userMessageIdForHistory = messageToEditId;

            updateMessageInConversation(activeConversationId, messageToEditId, {
                text: trimmedText,
                metadata: {
                    attachedFilesInfo: filesInfoForUIMessage.length > 0 ? filesInfoForUIMessage : undefined,
                    error: undefined,
                    abortedByUser: undefined,
                    userFacingError: undefined,
                    processingStatus: undefined,
                }
            });

            removeMessagesAfterId(activeConversationId, messageToEditId);

            const messagesUpToEdited = currentConversation.messages.slice(0, messageIndex + 1);
            historyForAPI = messagesUpToEdited.map(msg => {
                if (msg.id === messageToEditId) {
                    return { sender: 'user' as 'user', text: trimmedText };
                }
                if (msg.metadata?.rawParts && (msg.sender === 'model' || msg.sender === 'function')) {
                    return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                }
                return { sender: msg.sender, text: msg.text };
            });

            textForAI = trimmedText;

            aiMessageIdToStreamTo = addMessageToConversation(activeConversationId, {
                text: "", sender: 'model', metadata: { isLoading: true, respondingToUserMessageId: messageToEditId }
            });

        } else {
            // --- Submitting a new message ---
            userMessageIdForHistory = addMessageToConversation(activeConversationId, {
                text: trimmedText,
                sender: 'user',
                metadata: {
                    attachedFilesInfo: filesInfoForUIMessage.length > 0 ? filesInfoForUIMessage : undefined
                }
            });
            aiMessageIdToStreamTo = addMessageToConversation(activeConversationId, {
                text: "", sender: 'model', metadata: { isLoading: true, respondingToUserMessageId: userMessageIdForHistory }
            });

            const updatedConversationForNewMsg = conversations.find(c => c.id === activeConversationId);
            historyForAPI = (updatedConversationForNewMsg?.messages || [])
                .filter(msg => msg.id !== aiMessageIdToStreamTo)
                .map(msg => {
                    if (msg.metadata?.rawParts) {
                        return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                    }
                    return { sender: msg.sender, text: msg.text };
                });
            textForAI = trimmedText;
        }


        if (!aiMessageIdToStreamTo) {
            console.error("Não foi possível criar a mensagem placeholder da IA.");
            setIsLoadingAI(false);
            onSubmissionEnd?.({ focusTextarea: true, errorOccurred: true });
            return;
        }
        const finalAiMessageId = aiMessageIdToStreamTo;

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;

        try {
            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));
            const rawFilesForAPI: RawFileAttachment[] = filesToSendToAI
                .map(localFile => ({ file: localFile.file }));

            // historyToSendToGemini contains all messages *before* the current user's turn.
            const historyToSendToGemini = historyForAPI.slice(0, -1);

            const systemInstructionText = systemMessage({
                conversationTitle: currentConversation?.title,
                messageCountInConversation: historyForAPI.length,
                customPersonalityPrompt: settings.customPersonalityPrompt
            });

            const streamGenerator = streamMessageToGemini(
                settings.apiKey,
                historyToSendToGemini,
                textForAI,
                rawFilesForAPI,
                currentGlobalMemoriesWithObjects, settings.geminiModelConfig, systemInstructionText,
                settings.functionDeclarations || [], signal,
                webSearchActiveForThisSubmission
            );

            for await (const streamResponse of streamGenerator) {
                if (streamResponse.delta) {
                    if (!streamResponse.processingStatus || streamResponse.processingStatus.stage === 'completed') {
                        accumulatedAiText += streamResponse.delta;
                    }
                }
                if (streamResponse.processingStatus) {
                    lastProcessingStatusForInputRef.current = streamResponse.processingStatus;
                }
                if (streamResponse.rawPartsForNextTurn) {
                    accumulatedRawPartsForInputRef.current = [...streamResponse.rawPartsForNextTurn];
                }
                if (streamResponse.functionAttachedFilesInfo) {
                    accumulatedAttachedFilesInfoRef.current = [
                        ...accumulatedAttachedFilesInfoRef.current,
                        ...streamResponse.functionAttachedFilesInfo
                    ];
                }

                const showTypingCursor = !streamResponse.isFinished &&
                    !(lastProcessingStatusForInputRef.current &&
                        (lastProcessingStatusForInputRef.current.stage === 'pending' ||
                            lastProcessingStatusForInputRef.current.stage === 'in_progress' ||
                            lastProcessingStatusForInputRef.current.stage === 'awaiting_ai'));

                updateMessageInConversation(activeConversationId, finalAiMessageId, {
                    text: accumulatedAiText + (showTypingCursor ? "▍" : ""),
                    metadata: {
                        isLoading: !streamResponse.isFinished,
                        processingStatus: lastProcessingStatusForInputRef.current || undefined,
                        rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
                        attachedFilesInfo: accumulatedAttachedFilesInfoRef.current.length > 0 ? [...accumulatedAttachedFilesInfoRef.current] : undefined,
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
                abortedByUser: signal.aborted ? true : undefined,
                processingStatus: lastProcessingStatusForInputRef.current || undefined,
                rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
                attachedFilesInfo: accumulatedAttachedFilesInfoRef.current.length > 0 ? [...accumulatedAttachedFilesInfoRef.current] : undefined,
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
                                const newMemoryObject = addMemory(op.content);
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
            updateMessageInConversation(activeConversationId, finalAiMessageId, {
                text: finalDisplayableText, metadata: finalMetadata
            });

        } catch (error: unknown) {
            console.error("Falha catastrófica ao processar stream com Gemini:", error);
            const finalMetadataUpdate: Partial<MessageMetadata> = {
                isLoading: false,
                processingStatus: lastProcessingStatusForInputRef.current || undefined,
                rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
                attachedFilesInfo: accumulatedAttachedFilesInfoRef.current.length > 0 ? [...accumulatedAttachedFilesInfoRef.current] : undefined,
            };

            const isAbortError = (error as Error)?.name === 'AbortError' || signal.aborted;

            if (isAbortError) {
                finalMetadataUpdate.abortedByUser = true;
                finalMetadataUpdate.error = false;
                updateMessageInConversation(activeConversationId, finalAiMessageId, {
                    text: accumulatedAiText.replace(/▍$/, ''),
                    metadata: finalMetadataUpdate
                });
            } else {
                const clientErrorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu uma falha desconhecida no processamento da resposta.";
                finalMetadataUpdate.error = clientErrorMessage;
                finalMetadataUpdate.userFacingError = clientErrorMessage;
                setErrorFromAI(clientErrorMessage);
                updateMessageInConversation(activeConversationId, finalAiMessageId, {
                    text: accumulatedAiText.replace(/▍$/, ''), metadata: finalMetadataUpdate
                });
            }
        } finally {
            setIsLoadingAI(false);
            if (abortStreamControllerRef.current && abortStreamControllerRef.current.signal === signal) {
                abortStreamControllerRef.current = null;
            }
            lastProcessingStatusForInputRef.current = null;
            accumulatedRawPartsForInputRef.current = [];
            accumulatedAttachedFilesInfoRef.current = [];

            const errorOccurredForCallback = errorFromAI !== null || (streamError !== null && streamError !== undefined && !signal.aborted);

            onSubmissionEnd?.({
                focusTextarea: !messageToEditId,
                errorOccurred: errorOccurredForCallback
            });
        }
    };

    const handleAbortAIResponse = () => {
        if (isLoadingAI && abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("User aborted stream");
        }
    };

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
        setErrorFromAI,
        handleSubmit,
        handleAbortAIResponse,
        messageToEditId, // Added this line
    };
}
