// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Conversation, Message, MessageMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from './AppSettingsContext';
import { useMemories } from './MemoryContext';
import { streamMessageToGemini, type StreamedGeminiResponseChunk } from '../services/geminiService';
import { systemMessage } from '../prompts';
import type { Part } from '@google/genai'; // Import Part

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';
const CHUNK_RENDER_INTERVAL_MS = 200; // ms for rendering queued chunks

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
    isProcessingEditedMessage: boolean;
    setActiveConversationId: (id: string | null) => void;
    createNewConversation: () => Conversation;
    deleteConversation: (id: string) => void;
    deleteAllConversations: () => void;
    addMessageToConversation: (
        conversationId: string,
        messageContent: Omit<Message, 'id' | 'timestamp'> // Message can now have sender 'function'
    ) => string; // Returns new message ID
    updateMessageInConversation: (
        conversationId: string,
        messageId: string,
        updates: { text?: string; metadata?: Partial<MessageMetadata> }
    ) => void;
    updateConversationTitle: (id: string, newTitle: string) => void;
    removeMessageById: (conversationId: string, messageId: string) => void;
    regenerateResponseForEditedMessage: (
        conversationId: string,
        editedMessageId: string,
        newText: string
    ) => Promise<void>;
    abortEditedMessageResponse: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

const sortByUpdatedAtDesc = (a: Conversation, b: Conversation) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [conversations, setConversations] = useLocalStorage<Conversation[]>(CONVERSATIONS_KEY, []);
    const [activeId, setActiveId] = useLocalStorage<string | null>(ACTIVE_CONVERSATION_ID_KEY, null);
    const [isProcessingEditedMessage, setIsProcessingEditedMessage] = useState<boolean>(false);

    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    // Refs for managing streaming and UI updates for ongoing AI responses
    const chunkQueueRef = useRef<string[]>([]); // Holds text chunks from AI
    const accumulatedTextRef = useRef<string>(""); // Full text assembled from chunks for current AI msg
    const currentAiMessageIdRef = useRef<string | null>(null); // ID of the AI message being streamed to
    const currentConversationIdRef = useRef<string | null>(null); // ID of the active conversation for streaming
    const renderIntervalRef = useRef<NodeJS.Timeout | null>(null); // Timer for batched UI updates
    const streamHasFinishedRef = useRef<boolean>(false); // Flag if the stream from service has ended

    const localAbortEditedMessageControllerRef = useRef<AbortController | null>(null);

    const activeConversation = conversations.find(c => c.id === activeId) || null;

    const setActiveConversationId = useCallback((id: string | null) => setActiveId(id), [setActiveId]);

    const createNewConversation = useCallback((): Conversation => {
        const newConversation: Conversation = {
            id: uuidv4(),
            title: 'Nova Conversa',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setConversations(prev => [newConversation, ...prev].sort(sortByUpdatedAtDesc));
        setActiveId(newConversation.id);
        return newConversation;
    }, [setConversations, setActiveId]);

    const deleteConversation = useCallback((id: string) => {
        const updatedConversations = conversations.filter(c => c.id !== id);
        setConversations(updatedConversations);
        if (activeId === id) {
            setActiveId(
                updatedConversations.length > 0
                    ? [...updatedConversations].sort(sortByUpdatedAtDesc)[0].id
                    : null
            );
        }
    }, [conversations, activeId, setConversations, setActiveId]);

    const deleteAllConversations = useCallback(() => {
        setConversations([]);
        setActiveId(null);
    }, [setConversations, setActiveId]);

    const addMessageToConversation = useCallback((
        conversationId: string,
        messageContent: Omit<Message, 'id' | 'timestamp'>
    ): string => {
        const newMessageId = uuidv4();
        const newMessage: Message = {
            id: newMessageId,
            text: messageContent.text, // Text is primary, parts in metadata if needed
            sender: messageContent.sender,
            timestamp: new Date(),
            metadata: messageContent.metadata || {}, // metadata can include rawParts
        };
        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? {
                        ...c,
                        messages: [...c.messages, newMessage],
                        updatedAt: new Date(),
                        title: (c.messages.length === 0 && newMessage.sender === 'user' && newMessage.text.length > 0 && !newMessage.metadata?.temp)
                            ? newMessage.text.substring(0, 35) + (newMessage.text.length > 35 ? '…' : '')
                            : c.title,
                    }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );
        return newMessageId;
    }, [setConversations]);

    const updateMessageInConversation = useCallback((
        conversationId: string,
        messageId: string,
        updates: { text?: string; metadata?: Partial<MessageMetadata> }
    ) => {
        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? {
                        ...c,
                        messages: c.messages.map(msg =>
                            msg.id === messageId
                                ? {
                                    ...msg,
                                    ...(updates.text !== undefined && { text: updates.text }),
                                    ...(updates.metadata && { metadata: { ...msg.metadata, ...updates.metadata } }),
                                    timestamp: new Date() // Always update timestamp on modification
                                }
                                : msg
                        ),
                        updatedAt: new Date(), // Update conversation timestamp
                    }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );
    }, [setConversations]);

    const removeMessageById = useCallback((conversationId: string, messageId: string) => {
        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: c.messages.filter(m => m.id !== messageId), updatedAt: new Date() }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );
    }, [setConversations]);

    const updateConversationTitle = useCallback((id: string, newTitle: string) => {
        setConversations(prev =>
            prev.map(c =>
                c.id === id ? { ...c, title: newTitle, updatedAt: new Date() } : c
            ).sort(sortByUpdatedAtDesc)
        );
    }, [setConversations]);


    const processChunkQueue = useCallback(() => {
        if (renderIntervalRef.current) {
            clearTimeout(renderIntervalRef.current);
            renderIntervalRef.current = null;
        }

        if (currentAiMessageIdRef.current && currentConversationIdRef.current) {
            if (chunkQueueRef.current.length > 0) {
                const chunkToRender = chunkQueueRef.current.join(""); // Join all queued chunks for smoother rendering
                chunkQueueRef.current = []; // Clear queue
                accumulatedTextRef.current += chunkToRender;

                // Determine if the text is a status message or actual content
                const isStatusMessage = accumulatedTextRef.current.includes("[Loox: Executando a função") ||
                    accumulatedTextRef.current.includes("[Loox: Função") ||
                    accumulatedTextRef.current.includes("[Loox: Erro ao processar a função");

                updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                    text: accumulatedTextRef.current + (isStatusMessage || streamHasFinishedRef.current ? "" : "▍"),
                    metadata: { isLoading: !streamHasFinishedRef.current }
                });
            }

            // If the stream hasn't finished and there are no more chunks currently,
            // or if there are still chunks, schedule the next processing.
            if (!streamHasFinishedRef.current || chunkQueueRef.current.length > 0) {
                renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
            } else {
                // Stream finished, and queue is empty, final update without cursor
                updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                    text: accumulatedTextRef.current,
                    metadata: { isLoading: false }
                });
            }
        }
    }, [updateMessageInConversation]);


    useEffect(() => {
        return () => { // Cleanup on unmount
            if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
            if (localAbortEditedMessageControllerRef.current && !localAbortEditedMessageControllerRef.current.signal.aborted) {
                localAbortEditedMessageControllerRef.current.abort("Context unmounting");
            }
        };
    }, []);

    const abortEditedMessageResponse = useCallback(() => {
        if (localAbortEditedMessageControllerRef.current && !localAbortEditedMessageControllerRef.current.signal.aborted) {
            localAbortEditedMessageControllerRef.current.abort("User aborted edited message");
        }

        const convoId = currentConversationIdRef.current;
        const msgId = currentAiMessageIdRef.current;

        if (convoId && msgId) {
            // Finalize the message with whatever text was accumulated
            updateMessageInConversation(convoId, msgId, {
                text: accumulatedTextRef.current.replace(/▍$/, ''), // Remove cursor if present
                metadata: {
                    isLoading: false,
                    error: false, // Explicitly set no error on user abort
                    abortedByUser: true
                }
            });
        }

        // Cleanup refs and state
        if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        renderIntervalRef.current = null;
        setIsProcessingEditedMessage(false);
        chunkQueueRef.current = [];
        accumulatedTextRef.current = "";
        streamHasFinishedRef.current = true; // Mark as finished
        currentAiMessageIdRef.current = null;
        currentConversationIdRef.current = null;
        if (localAbortEditedMessageControllerRef.current) {
            localAbortEditedMessageControllerRef.current = null;
        }
    }, [updateMessageInConversation]);


    const regenerateResponseForEditedMessage = useCallback(async (
        conversationId: string,
        editedMessageId: string,
        newText: string
    ): Promise<void> => {

        if (isProcessingEditedMessage) return; // Prevent multiple regenerations

        if (localAbortEditedMessageControllerRef.current && !localAbortEditedMessageControllerRef.current.signal.aborted) {
            localAbortEditedMessageControllerRef.current.abort("New regeneration started");
        }
        localAbortEditedMessageControllerRef.current = new AbortController();
        const signal = localAbortEditedMessageControllerRef.current.signal;

        // Reset state for the new regeneration
        if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        chunkQueueRef.current = [];
        accumulatedTextRef.current = "";
        streamHasFinishedRef.current = false;
        setIsProcessingEditedMessage(true);

        if (!settings.apiKey) {
            // No API key, add error message and stop
            const errorMsgId = addMessageToConversation(conversationId, {
                text: "Erro: Chave de API não configurada.", sender: 'model', metadata: { error: true }
            });
            updateMessageInConversation(conversationId, errorMsgId, { metadata: { isLoading: false } });
            setIsProcessingEditedMessage(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        const conversationToUpdate = conversations.find(c => c.id === conversationId);
        if (!conversationToUpdate) {
            setIsProcessingEditedMessage(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        const messageIndex = conversationToUpdate.messages.findIndex(msg => msg.id === editedMessageId);
        if (messageIndex === -1) {
            setIsProcessingEditedMessage(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        // Truncate history up to the edited message and update its text
        const updatedMessagesForHistory = conversationToUpdate.messages.slice(0, messageIndex + 1);
        updatedMessagesForHistory[messageIndex] = {
            ...updatedMessagesForHistory[messageIndex],
            text: newText,
            timestamp: new Date(),
            metadata: { ...updatedMessagesForHistory[messageIndex].metadata, error: undefined, abortedByUser: undefined, userFacingError: undefined } // Clear previous errors
        };

        // Update the conversation state with the modified user message and remove subsequent messages
        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: updatedMessagesForHistory, updatedAt: new Date() }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );

        // Add a new placeholder message for the AI's regenerated response
        const newAiMessageId = addMessageToConversation(conversationId, {
            text: "", sender: 'model', metadata: { isLoading: true }
        });
        if (!newAiMessageId) {
            setIsProcessingEditedMessage(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        currentAiMessageIdRef.current = newAiMessageId;
        currentConversationIdRef.current = conversationId;

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;
        let finalAiResponseText = "";
        // let finalAiResponseParts: Part[] | undefined = undefined; // If service sends final parts

        renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS); // Start processing queue

        try {
            // Prepare history for geminiService, ensuring Part[] compatibility
            const historyForAPI: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[] =
                updatedMessagesForHistory.map(msg => { // Use updatedMessagesForHistory
                    if (msg.metadata?.rawParts) {
                        return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                    }
                    return { sender: msg.sender, text: msg.text };
                });

            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));

            const streamGenerator = streamMessageToGemini(
                settings.apiKey,
                historyForAPI.slice(0, -1), // All messages before the (newly updated) user message
                newText,                      // The new text of the user message being edited
                [],                           // No new file attachments for regeneration
                currentGlobalMemoriesWithObjects,
                settings.geminiModelConfig,
                systemMessage({
                    conversationTitle: conversationToUpdate.title,
                    messageCountInConversation: historyForAPI.length, // Count based on history sent to API
                    customPersonalityPrompt: settings.customPersonalityPrompt
                }),
                settings.functionDeclarations || [],
                signal
            );

            for await (const streamResponse of streamGenerator) {
                if (signal.aborted) {
                    streamError = "Resposta abortada pelo usuário.";
                    break;
                }
                if (streamResponse.delta) {
                    chunkQueueRef.current.push(streamResponse.delta);
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    // Don't break immediately if error allows stream to continue (e.g. partial file error)
                    // accumulatedTextRef will include the error for display if it's appended by service.
                }
                if (streamResponse.isFinished) {
                    finalAiResponseText = streamResponse.finalText || accumulatedTextRef.current; // Use accumulated if finalText is empty
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    // if ((streamResponse as any).finalPartsForHistory) {
                    //    finalAiResponseParts = (streamResponse as any).finalPartsForHistory;
                    // }
                    break;
                }
            }
            streamHasFinishedRef.current = true; // Mark stream as finished processing here
            // Ensure all queued chunks are processed by potentially calling processChunkQueue one last time
            // or waiting for the interval to clear them.
            if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current); // Clear existing timer
            processChunkQueue(); // Process any remaining chunks immediately


        } catch (error) { // Catch errors from streamMessageToGemini itself
            if (!((error as Error).name === 'AbortError' || signal.aborted)) {
                console.error("Erro ao regenerar resposta:", error);
                streamError = (error as Error).message || "Erro desconhecido na regeneração";
            } else if (signal.aborted && !streamError) { // If aborted but no specific error set
                streamError = "Resposta abortada pelo usuário.";
            }
        } finally {
            streamHasFinishedRef.current = true; // Ensure it's true
            if (renderIntervalRef.current) { // Clear timer if it was somehow re-set
                clearTimeout(renderIntervalRef.current);
                renderIntervalRef.current = null;
            }
            // Final update to the AI message based on outcome
            const finalMetadata: Partial<MessageMetadata> = {
                isLoading: false,
                abortedByUser: streamError === "Resposta abortada pelo usuário." || (signal.aborted && !streamError) ? true : undefined,
                // rawParts: finalAiResponseParts, // Store if captured
            };
            if (streamError && !finalMetadata.abortedByUser) {
                finalMetadata.error = streamError;
                finalMetadata.userFacingError = streamError;
            }

            let textForFinalMessage = (finalAiResponseText || accumulatedTextRef.current).replace(/▍$/, '');
            if (streamError && !finalMetadata.abortedByUser && !textForFinalMessage.includes(streamError)) {
                textForFinalMessage = textForFinalMessage.trim() ? `${textForFinalMessage}\n\n⚠️ ${streamError}` : `⚠️ ${streamError}`;
            } else if (textForFinalMessage.includes('\n\n⚠️ ') && !streamError && !finalMetadata.abortedByUser) {
                textForFinalMessage = textForFinalMessage.replace(/\n\n⚠️ .+$/, '').trim();
            }


            // Process memory operations
            if (!streamError || finalMetadata.abortedByUser) { // Process even if aborted, as some might be valid
                const processedMemoryActions: Required<MessageMetadata>['memorizedMemoryActions'] = [];
                if (memoryOperationsFromServer && memoryOperationsFromServer.length > 0) {
                    memoryOperationsFromServer.forEach(op => {
                        if (op.action === 'create' && op.content) {
                            const newMem = addMemory(op.content);
                            if (newMem) processedMemoryActions.push({ ...newMem, action: 'created' });
                        } else if (op.action === 'update' && op.targetMemoryContent && op.content) {
                            const memToUpdate = globalMemoriesFromHook.find(m => m.content.toLowerCase() === op.targetMemoryContent?.toLowerCase());
                            if (memToUpdate) {
                                updateMemory(memToUpdate.id, op.content);
                                processedMemoryActions.push({ id: memToUpdate.id, content: op.content, originalContent: memToUpdate.content, action: 'updated' });
                            } else {
                                const newMem = addMemory(op.content); // Add as new if target not found
                                if (newMem) processedMemoryActions.push({ ...newMem, action: 'created' });
                            }
                        } else if (op.action === 'delete_by_ai_suggestion' && op.targetMemoryContent) {
                            const memToDelete = globalMemoriesFromHook.find(m => m.content.toLowerCase() === op.targetMemoryContent?.toLowerCase());
                            if (memToDelete) {
                                deleteMemoryFromHook(memToDelete.id);
                                processedMemoryActions.push({ ...memToDelete, originalContent: memToDelete.content, action: 'deleted_by_ai' });
                            }
                        }
                    });
                    if (processedMemoryActions.length > 0) {
                        finalMetadata.memorizedMemoryActions = processedMemoryActions;
                    }
                }
            }

            updateMessageInConversation(conversationId, newAiMessageId, {
                text: textForFinalMessage,
                metadata: finalMetadata
            });

            // Reset for next operation
            currentAiMessageIdRef.current = null;
            currentConversationIdRef.current = null;
            chunkQueueRef.current = [];
            accumulatedTextRef.current = "";
            if (localAbortEditedMessageControllerRef.current && localAbortEditedMessageControllerRef.current.signal === signal) {
                localAbortEditedMessageControllerRef.current = null;
            }
            setIsProcessingEditedMessage(false);
        }
    }, [
        settings.apiKey, settings.geminiModelConfig, settings.customPersonalityPrompt, settings.functionDeclarations,
        globalMemoriesFromHook, addMemory, updateMemory, deleteMemoryFromHook,
        conversations, setConversations, addMessageToConversation, updateMessageInConversation,
        processChunkQueue, isProcessingEditedMessage, // Added isProcessingEditedMessage
    ]);


    return (
        <ConversationContext.Provider value={{
            conversations,
            activeConversationId: activeId,
            activeConversation,
            isProcessingEditedMessage,
            setActiveConversationId,
            createNewConversation,
            deleteConversation,
            deleteAllConversations,
            addMessageToConversation,
            updateMessageInConversation,
            updateConversationTitle,
            removeMessageById,
            regenerateResponseForEditedMessage,
            abortEditedMessageResponse,
        }}>
            {children}
        </ConversationContext.Provider>
    );
};

export const useConversations = (): ConversationContextType => {
    const context = useContext(ConversationContext);
    if (context === undefined) {
        throw new Error('useConversations must be used within a ConversationProvider');
    }
    return context;
};
