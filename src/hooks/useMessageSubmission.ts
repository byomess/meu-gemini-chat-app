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
    messageToEditId?: string; // New: ID of the user message being edited
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
        // abortEditedMessageResponse will be handled by this hook's abort logic
        // isProcessingEditedMessage will be replaced by this hook's isLoadingAI
    } = useConversations();
    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);

    const abortStreamControllerRef = useRef<AbortController | null>(null);
    const lastProcessingStatusForInputRef = useRef<ProcessingStatus | null>(null);
    const accumulatedRawPartsForInputRef = useRef<Part[]>([]);
    const accumulatedAttachedFilesInfoRef = useRef<AttachedFileInfo[]>([]); // New ref for attached files from functions

    const handleSubmit = async () => {
        setErrorFromAI(null);
        const trimmedText = text.trim();
        const hasFilesToSend = (settings.enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) && attachedFiles.length > 0;
        const hasContentToSend = trimmedText || hasFilesToSend;

        // If editing, text can be empty if attachments exist (or if deleting all content and attachments)
        // If not editing, content must be present.
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

        // filesInfoForUIMessage should include ALL files (placeholders from edit and new ones)
        // to correctly update the user message metadata in the UI.
        // The `attachedFiles` prop to this hook will be `editedAttachedFiles` from MessageBubble during an edit.
        const filesInfoForUIMessage: AttachedFileInfo[] = attachedFiles
            .filter(localFile => settings.enableAttachments || localFile.file.type.startsWith('audio/')) // Basic filter
            .map(localFile => ({
                id: localFile.id, // Preserve original ID for placeholders
                name: localFile.name,
                type: localFile.type,
                size: localFile.size,
                dataUrl: localFile.previewUrl, // This will be present for placeholders too
            }));

        // filesToSendToAI for the API call should ONLY include NEW files (not placeholders).
        // These are files that actually have a File object and are not marked as placeholders.
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

            // Update the user's message in place
            updateMessageInConversation(activeConversationId, messageToEditId, {
                text: trimmedText,
                metadata: {
                    attachedFilesInfo: filesInfoForUIMessage.length > 0 ? filesInfoForUIMessage : undefined,
                    error: undefined,
                    abortedByUser: undefined,
                    userFacingError: undefined,
                    processingStatus: undefined,
                    // Ensure rawParts are cleared if the text/attachments change significantly,
                    // or handle them appropriately if they should persist/be modified.
                    // For now, let's assume they are implicitly handled by the new AI response.
                }
            });

            // History for API is up to and including the edited message
            // Subsequent AI/function messages related to the *original* user message are effectively orphaned
            // and will be "overwritten" by the new AI response stream.
            // The ConversationContext's `addMessageToConversation` for the new AI message will place it correctly.
            const messagesUpToAndIncludingEdited = currentConversation.messages.slice(0, messageIndex + 1).map((msg, idx) => {
                if (idx === messageIndex) { // This is the message being edited
                    return {
                        ...msg,
                        text: trimmedText, // Use the new text
                        metadata: { // Use the new metadata
                            ...msg.metadata,
                            attachedFilesInfo: filesInfoForUIMessage.length > 0 ? filesInfoForUIMessage : undefined,
                            error: undefined,
                            abortedByUser: undefined,
                            userFacingError: undefined,
                            processingStatus: undefined,
                        }
                    };
                }
                return msg;
            });


            historyForAPI = messagesUpToAndIncludingEdited
                .map(msg => {
                    if (msg.metadata?.rawParts && (msg.sender === 'model' || msg.sender === 'function')) {
                        return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                    }
                    // For the user message being edited, its text is already updated in messagesUpToAndIncludingEdited
                    return { sender: msg.sender, text: msg.text };
                });
            
            textForAI = trimmedText; // The AI will respond to this new text

            // Add a new placeholder for the AI's response to the edited message
            // This new AI message will follow the edited user message.
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

            // History includes the newly added user message
            const updatedConversationForNewMsg = conversations.find(c => c.id === activeConversationId);
            historyForAPI = (updatedConversationForNewMsg?.messages || [])
                .filter(msg => msg.id !== aiMessageIdToStreamTo) // Exclude the current AI placeholder
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
            // rawFilesForAPI should be built from filesToSendToAI (which are new, non-placeholder files)
            const rawFilesForAPI: RawFileAttachment[] = filesToSendToAI
                .map(localFile => ({ file: localFile.file }));


            // Construct history for Gemini:
            // For an edited message, historyForAPI already includes the updated user message (with its text and full AttachedFileInfo).
            // The textForAI is the new prompt.
            // The geminiService will handle embedding file metadata from the user's message if `rawFilesForAPI` is empty but the message has attachments.
            // However, to be explicit, we can prepare parts for the user's turn if there are attachments.
            
            let userTurnParts: Part[] = [{ text: textForAI }]; // Default user turn part

            // This section was an attempt to build userTurnParts with fileData, but it's complex without fileUri.
            // Let's stick to the simpler model for now: textForAI and rawFilesForAPI (new files).
            // The history (historyToSendToGemini) will contain previous turns.

            const historyToSendToGemini = messageToEditId
                ? historyForAPI.slice(0, -1) // All messages *before* the edited user message
                : historyForAPI.filter(msg => msg.sender !== 'user' || (userMessageIdForHistory && msg.text !== textForAI)); // Original logic for new messages


            const systemInstructionText = systemMessage({
                conversationTitle: currentConversation?.title,
                // messageCountInConversation should reflect the state *before* this new AI response.
                messageCountInConversation: historyForAPI.length,
                customPersonalityPrompt: settings.customPersonalityPrompt
            });

            const streamGenerator = streamMessageToGemini(
                settings.apiKey,
                historyToSendToGemini, // History before the current user's turn
                textForAI, // The current user's message text
                rawFilesForAPI,
                currentGlobalMemoriesWithObjects, settings.geminiModelConfig, systemInstructionText,
                settings.functionDeclarations || [], signal,
                webSearchActiveForThisSubmission
            );

            for await (const streamResponse of streamGenerator) {
                // The streamGenerator itself will throw an AbortError if the signal is aborted.
                // No need for manual signal.aborted check here.

                if (streamResponse.delta) {
                    // Only accumulate delta if it's not a processing status message.
                    // Processing status messages are handled by the processingStatus metadata.
                    // If processingStatus is present AND its stage is not 'completed',
                    // then this delta is likely a temporary processing message.
                    // Otherwise, it's actual AI text.
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
                if (streamResponse.functionAttachedFilesInfo) { // Handle new attached files from function calls
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
                        attachedFilesInfo: accumulatedAttachedFilesInfoRef.current.length > 0 ? [...accumulatedAttachedFilesInfoRef.current] : undefined, // Include accumulated files
                        // respondingToUserMessageId is set when AI message is created
                    }
                });

                if (streamResponse.error) {
                    streamError = streamResponse.error; // Capture error reported by the service
                }
                if (streamResponse.isFinished) {
                    accumulatedAiText = streamResponse.finalText || accumulatedAiText.replace(/▍$/, '');
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }

            const finalMetadata: Partial<MessageMetadata> = {
                isLoading: false,
                // If streamError is set, it means an API-reported error occurred.
                // If signal.aborted is true, it means user aborted.
                abortedByUser: signal.aborted ? true : undefined,
                processingStatus: lastProcessingStatusForInputRef.current || undefined,
                rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
                attachedFilesInfo: accumulatedAttachedFilesInfoRef.current.length > 0 ? [...accumulatedAttachedFilesInfoRef.current] : undefined, // Final accumulated files
            };

            if (streamError && !finalMetadata.abortedByUser) { // Only set error if it's not a user abort
                finalMetadata.error = streamError;
                finalMetadata.userFacingError = streamError;
                if (lastProcessingStatusForInputRef.current && lastProcessingStatusForInputRef.current.stage !== 'completed' && lastProcessingStatusForInputRef.current.stage !== 'failed') {
                    finalMetadata.processingStatus = { ...(lastProcessingStatusForInputRef.current || {} as ProcessingStatus), stage: 'failed', error: streamError };
                }
            }

            if (!streamError || finalMetadata.abortedByUser) { // Process memories only if no stream error or if it was aborted by user
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
                    text: accumulatedAiText.replace(/▍$/, ''), // Preserve any text if abort happened mid-stream
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
                focusTextarea: !messageToEditId, // Only focus textarea for new messages, not edits
                errorOccurred: errorOccurredForCallback
            });
        }
    };

    const handleAbortAIResponse = () => {
        if (isLoadingAI && abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("User aborted stream");
            // setIsLoadingAI(false); // Let the finally block handle this
            // The onSubmissionEnd will be called by the finally block of handleSubmit
            // once the promise chain resolves/rejects due to the abort.
        }
        // No need to call abortEditedMessageResponse from context, as this hook now handles all aborts.
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
        setErrorFromAI,
        handleSubmit,
        handleAbortAIResponse,
        // isProcessingEditedMessage is no longer needed from context, this hook's isLoadingAI serves the purpose.
    };
}
