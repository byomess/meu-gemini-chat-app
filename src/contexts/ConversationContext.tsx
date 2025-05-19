// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Conversation, Message, MessageMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from './AppSettingsContext';
import { useMemories } from './MemoryContext';
import { streamMessageToGemini, type StreamedGeminiResponseChunk } from '../services/geminiService';
import { systemMessage } from '../prompts';
import type { Part } from '@google/genai';

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';
const CHUNK_RENDER_INTERVAL_MS = 200;

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
    isProcessingEditedMessage: boolean;
    isGeneratingResponse: boolean; // Added
    setActiveConversationId: (id: string | null) => void;
    createNewConversation: () => Conversation;
    deleteConversation: (id: string) => void;
    deleteAllConversations: () => void;
    addMessageToConversation: (
        conversationId: string,
        messageContent: Omit<Message, 'id' | 'timestamp'>
    ) => string;
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
    const [isGeneratingResponse, setIsGeneratingResponse] = useState<boolean>(false); // Added state

    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const chunkQueueRef = useRef<string[]>([]);
    const accumulatedTextRef = useRef<string>("");
    const currentAiMessageIdRef = useRef<string | null>(null);
    const currentConversationIdRef = useRef<string | null>(null);
    const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const streamHasFinishedRef = useRef<boolean>(false);

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
            text: messageContent.text,
            sender: messageContent.sender,
            timestamp: new Date(),
            metadata: messageContent.metadata || {},
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
                                    timestamp: new Date()
                                }
                                : msg
                        ),
                        updatedAt: new Date(),
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
                const chunkToRender = chunkQueueRef.current.join("");
                chunkQueueRef.current = [];
                accumulatedTextRef.current += chunkToRender;

                const isStatusMessage = accumulatedTextRef.current.includes("[Loox: Executando a função") ||
                    accumulatedTextRef.current.includes("[Loox: Função") ||
                    accumulatedTextRef.current.includes("[Loox: Erro ao processar a função");

                updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                    text: accumulatedTextRef.current + (isStatusMessage || streamHasFinishedRef.current ? "" : "▍"),
                    metadata: { isLoading: !streamHasFinishedRef.current }
                });
            }

            if (!streamHasFinishedRef.current || chunkQueueRef.current.length > 0) {
                renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
            } else {
                updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                    text: accumulatedTextRef.current,
                    metadata: { isLoading: false }
                });
            }
        }
    }, [updateMessageInConversation]);


    useEffect(() => {
        return () => {
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
            updateMessageInConversation(convoId, msgId, {
                text: accumulatedTextRef.current.replace(/▍$/, ''),
                metadata: {
                    isLoading: false,
                    error: false,
                    abortedByUser: true
                }
            });
        }

        if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        renderIntervalRef.current = null;
        setIsProcessingEditedMessage(false);
        setIsGeneratingResponse(false); // Reset here
        chunkQueueRef.current = [];
        accumulatedTextRef.current = "";
        streamHasFinishedRef.current = true;
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

        if (isProcessingEditedMessage) return;

        if (localAbortEditedMessageControllerRef.current && !localAbortEditedMessageControllerRef.current.signal.aborted) {
            localAbortEditedMessageControllerRef.current.abort("New regeneration started");
        }
        localAbortEditedMessageControllerRef.current = new AbortController();
        const signal = localAbortEditedMessageControllerRef.current.signal;

        if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        chunkQueueRef.current = [];
        accumulatedTextRef.current = "";
        streamHasFinishedRef.current = false;
        setIsProcessingEditedMessage(true);
        setIsGeneratingResponse(true); // Set true at the beginning of generation

        if (!settings.apiKey) {
            const errorMsgId = addMessageToConversation(conversationId, {
                text: "Erro: Chave de API não configurada.", sender: 'model', metadata: { error: true }
            });
            updateMessageInConversation(conversationId, errorMsgId, { metadata: { isLoading: false } });
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false); // Reset
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        const conversationToUpdate = conversations.find(c => c.id === conversationId);
        if (!conversationToUpdate) {
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false); // Reset
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        const messageIndex = conversationToUpdate.messages.findIndex(msg => msg.id === editedMessageId);
        if (messageIndex === -1) {
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false); // Reset
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        const updatedMessagesForHistory = conversationToUpdate.messages.slice(0, messageIndex + 1);
        updatedMessagesForHistory[messageIndex] = {
            ...updatedMessagesForHistory[messageIndex],
            text: newText,
            timestamp: new Date(),
            metadata: { ...updatedMessagesForHistory[messageIndex].metadata, error: undefined, abortedByUser: undefined, userFacingError: undefined }
        };

        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: updatedMessagesForHistory, updatedAt: new Date() }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );

        const newAiMessageId = addMessageToConversation(conversationId, {
            text: "", sender: 'model', metadata: { isLoading: true }
        });
        if (!newAiMessageId) {
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false); // Reset
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        currentAiMessageIdRef.current = newAiMessageId;
        currentConversationIdRef.current = conversationId;

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;
        let finalAiResponseText = "";

        renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);

        try {
            const historyForAPI: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[] =
                updatedMessagesForHistory.map(msg => {
                    if (msg.metadata?.rawParts) {
                        return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                    }
                    return { sender: msg.sender, text: msg.text };
                });

            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));

            const streamGenerator = streamMessageToGemini(
                settings.apiKey,
                historyForAPI.slice(0, -1),
                newText,
                [],
                currentGlobalMemoriesWithObjects,
                settings.geminiModelConfig,
                systemMessage({
                    conversationTitle: conversationToUpdate.title,
                    messageCountInConversation: historyForAPI.length,
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
                }
                if (streamResponse.isFinished) {
                    finalAiResponseText = streamResponse.finalText || accumulatedTextRef.current;
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }
            streamHasFinishedRef.current = true;
            if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
            processChunkQueue();


        } catch (error) {
            if (!((error as Error).name === 'AbortError' || signal.aborted)) {
                console.error("Erro ao regenerar resposta:", error);
                streamError = (error as Error).message || "Erro desconhecido na regeneração";
            } else if (signal.aborted && !streamError) {
                streamError = "Resposta abortada pelo usuário.";
            }
        } finally {
            streamHasFinishedRef.current = true;
            if (renderIntervalRef.current) {
                clearTimeout(renderIntervalRef.current);
                renderIntervalRef.current = null;
            }
            const finalMetadata: Partial<MessageMetadata> = {
                isLoading: false,
                abortedByUser: streamError === "Resposta abortada pelo usuário." || (signal.aborted && !streamError) ? true : undefined,
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


            if (!streamError || finalMetadata.abortedByUser) {
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
                                const newMem = addMemory(op.content);
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

            currentAiMessageIdRef.current = null;
            currentConversationIdRef.current = null;
            chunkQueueRef.current = [];
            accumulatedTextRef.current = "";
            if (localAbortEditedMessageControllerRef.current && localAbortEditedMessageControllerRef.current.signal === signal) {
                localAbortEditedMessageControllerRef.current = null;
            }
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false); // Reset false at the end of generation
        }
    }, [
        settings.apiKey, settings.geminiModelConfig, settings.customPersonalityPrompt, settings.functionDeclarations,
        globalMemoriesFromHook, addMemory, updateMemory, deleteMemoryFromHook,
        conversations, setConversations, addMessageToConversation, updateMessageInConversation,
        processChunkQueue, isProcessingEditedMessage,
    ]);


    return (
        <ConversationContext.Provider value={{
            conversations,
            activeConversationId: activeId,
            activeConversation,
            isProcessingEditedMessage,
            isGeneratingResponse, // Expose here
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