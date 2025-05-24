/* eslint-disable @typescript-eslint/no-explicit-any */
// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Conversation, Message, MessageMetadata, ProcessingStatus, Part } from '../types'; // Adicionado ProcessingStatus e Part
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from './AppSettingsContext';
import { useMemories } from './MemoryContext';
import { streamMessageToGemini, type StreamedGeminiResponseChunk } from '../services/geminiService';
import { systemMessage } from '../prompts';
// Removido: import type { Part } from '@google/genai'; // Já está vindo de ../types

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';
const CHUNK_RENDER_INTERVAL_MS = 200; // Reduzido para atualizações mais rápidas de status

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
    isProcessingEditedMessage: boolean;
    isGeneratingResponse: boolean;
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
    const [isGeneratingResponse, setIsGeneratingResponse] = useState<boolean>(false);

    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const chunkQueueRef = useRef<string[]>([]);
    const accumulatedTextRef = useRef<string>(""); // This will now only accumulate actual AI response text
    const currentAiMessageIdRef = useRef<string | null>(null);
    const currentConversationIdRef = useRef<string | null>(null);
    const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const streamHasFinishedRef = useRef<boolean>(false);
    const lastProcessingStatusRef = useRef<ProcessingStatus | null>(null);
    const accumulatedRawPartsRef = useRef<Part[]>([]);


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
                                    timestamp: new Date() // Atualiza timestamp para re-renderizações se necessário
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
            let textToUpdate = accumulatedTextRef.current;
            const newMetadata: Partial<MessageMetadata> = {
                isLoading: !streamHasFinishedRef.current,
            };

            if (chunkQueueRef.current.length > 0) {
                const chunkToRender = chunkQueueRef.current.join("");
                chunkQueueRef.current = []; // Limpa a fila de texto
                // Note: In ConversationContext, chunkQueueRef.current only receives actual AI text
                // because streamMessageToGemini yields processingStatus separately, and we filter delta.
                // So, we can directly accumulate here.
                textToUpdate += chunkToRender;
                accumulatedTextRef.current = textToUpdate; // Atualiza o acumulado
            }

            // Adiciona o cursor de digitação se não for uma mensagem de status puro e o stream não terminou
            const isStatusMessage = lastProcessingStatusRef.current &&
                (lastProcessingStatusRef.current.stage === 'in_progress' || lastProcessingStatusRef.current.stage === 'pending');

            if (!isStatusMessage && !streamHasFinishedRef.current) {
                textToUpdate += "▍";
            }

            newMetadata.processingStatus = lastProcessingStatusRef.current || undefined;
            if (accumulatedRawPartsRef.current.length > 0) {
                newMetadata.rawParts = [...accumulatedRawPartsRef.current];
            }


            updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                text: textToUpdate,
                metadata: newMetadata
            });

            // Se o stream não terminou ou ainda há chunks de texto na fila (improvável aqui, mas seguro)
            if (!streamHasFinishedRef.current || chunkQueueRef.current.length > 0) {
                renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
            } else {
                // Certifica-se de que a mensagem final está sem o cursor e com metadados corretos
                updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                    text: accumulatedTextRef.current, // Sem o cursor
                    metadata: {
                        isLoading: false,
                        processingStatus: lastProcessingStatusRef.current || undefined,
                        rawParts: accumulatedRawPartsRef.current.length > 0 ? [...accumulatedRawPartsRef.current] : undefined,
                    }
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
                text: "", // Clear the message text on abort
                metadata: {
                    isLoading: false,
                    error: false, // ou true se o aborto for considerado um erro
                    abortedByUser: true,
                    processingStatus: lastProcessingStatusRef.current?.stage !== 'completed' && lastProcessingStatusRef.current?.stage !== 'failed' ?
                        { ...(lastProcessingStatusRef.current || {} as ProcessingStatus), stage: 'failed', error: 'Abortado pelo usuário' }
                        : lastProcessingStatusRef.current || undefined,
                    rawParts: accumulatedRawPartsRef.current.length > 0 ? [...accumulatedRawPartsRef.current] : undefined,

                }
            });
        }

        if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        renderIntervalRef.current = null;
        setIsProcessingEditedMessage(false);
        setIsGeneratingResponse(false);
        chunkQueueRef.current = [];
        accumulatedTextRef.current = "";
        streamHasFinishedRef.current = true;
        currentAiMessageIdRef.current = null;
        currentConversationIdRef.current = null;
        lastProcessingStatusRef.current = null;
        accumulatedRawPartsRef.current = [];
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
        lastProcessingStatusRef.current = null;
        accumulatedRawPartsRef.current = [];
        setIsProcessingEditedMessage(true);
        setIsGeneratingResponse(true);

        if (!settings.apiKey) {
            // const errorMsgId = addMessageToConversation(conversationId, {
            //     text: "Erro: Chave de API não configurada.", sender: 'model', metadata: { error: true, isLoading: false }
            // });
            // updateMessageInConversation(conversationId, errorMsgId, { metadata: { isLoading: false } }); // isLoading já é false
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        const conversationToUpdate = conversations.find(c => c.id === conversationId);
        if (!conversationToUpdate) {
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        const messageIndex = conversationToUpdate.messages.findIndex(msg => msg.id === editedMessageId);
        if (messageIndex === -1) {
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        // Remove mensagens da IA e de função após a mensagem editada
        const updatedMessagesForHistory = conversationToUpdate.messages.slice(0, messageIndex + 1);
        updatedMessagesForHistory[messageIndex] = {
            ...updatedMessagesForHistory[messageIndex],
            text: newText,
            timestamp: new Date(),
            metadata: {
                ...updatedMessagesForHistory[messageIndex].metadata,
                error: undefined,
                abortedByUser: undefined,
                userFacingError: undefined,
                processingStatus: undefined, // Limpa status anterior da mensagem do usuário
                // rawParts: undefined, // Limpa rawParts da mensagem do usuário, se houver
            }
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
            setIsGeneratingResponse(false);
            localAbortEditedMessageControllerRef.current = null;
            return;
        }

        currentAiMessageIdRef.current = newAiMessageId;
        currentConversationIdRef.current = conversationId;

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;
        let finalAiResponseText = "";

        // Inicia o loop de renderização imediatamente
        renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);

        try {
            const historyForAPI: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[] =
                updatedMessagesForHistory.map(msg => {
                    // Para o histórico da API, se a mensagem tiver rawParts, use-as. Senão, use o texto.
                    // Mensagens de 'function' (resposta da função) devem usar suas 'parts' se existirem.
                    if (msg.metadata?.rawParts && (msg.sender === 'model' || msg.sender === 'function')) {
                        return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                    }
                    return { sender: msg.sender, text: msg.text };
                });

            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));

            const streamGenerator = streamMessageToGemini(
                settings.apiKey,
                historyForAPI.slice(0, -1), // Exclui a mensagem do usuário atual, que será passada como `newText`
                newText, // Texto da mensagem do usuário atual (editada)
                updatedMessagesForHistory[messageIndex].metadata?.attachedFilesInfo?.map(f => ({ file: f as any })) || [], // TODO: Precisa adaptar se for reenviar arquivos de fato
                currentGlobalMemoriesWithObjects,
                settings.geminiModelConfig,
                systemMessage({
                    conversationTitle: conversationToUpdate.title,
                    messageCountInConversation: historyForAPI.length,
                    customPersonalityPrompt: settings.customPersonalityPrompt
                }),
                settings.functionDeclarations || [],
                signal,
                settings.geminiModelConfig.model.startsWith("gemini-1.5-pro") // Exemplo de como habilitar web search
            );

            for await (const streamResponse of streamGenerator) {
                if (signal.aborted) {
                    streamError = "Resposta abortada pelo usuário.";
                    break;
                }
                if (streamResponse.delta) {
                    // Only add delta to chunkQueue if it's not a processing status message.
                    // This ensures chunkQueueRef.current only contains actual AI text.
                    if (!streamResponse.processingStatus || streamResponse.processingStatus.stage === 'completed') {
                        chunkQueueRef.current.push(streamResponse.delta);
                    }
                }
                if (streamResponse.processingStatus) {
                    lastProcessingStatusRef.current = streamResponse.processingStatus;
                    // Força uma atualização da UI para mostrar o status imediatamente
                    if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
                    processChunkQueue(); // Chama diretamente para refletir o status
                }
                if (streamResponse.rawPartsForNextTurn) {
                    // Acumula as parts para a mensagem da IA atual.
                    // Se for um functionCall, estas parts serão importantes.
                    accumulatedRawPartsRef.current = [...streamResponse.rawPartsForNextTurn];
                    if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
                    processChunkQueue();
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    // Não quebre o loop aqui, deixe o isFinished finalizar para pegar o texto acumulado
                }
                if (streamResponse.isFinished) {
                    finalAiResponseText = streamResponse.finalText || accumulatedTextRef.current;
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }
            streamHasFinishedRef.current = true; // Indica que o stream terminou
            // Limpa o intervalo e chama processChunkQueue uma última vez para renderizar o estado final
            if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
            renderIntervalRef.current = null; // Garante que não haverá mais execuções agendadas
            processChunkQueue();


        } catch (error) {
            const isAbortError = (error as Error)?.name === 'AbortError';
            if (isAbortError || signal.aborted) {
                streamError = "Resposta abortada pelo usuário.";
            } else {
                console.error("Erro ao regenerar resposta:", error);
                streamError = (error as Error).message || "Erro desconhecido na regeneração";
            }
        } finally {
            streamHasFinishedRef.current = true;
            if (renderIntervalRef.current) {
                clearTimeout(renderIntervalRef.current);
                renderIntervalRef.current = null;
            }
            const finalMetadata: Partial<MessageMetadata> = {
                isLoading: false,
                abortedByUser: streamError === "Resposta abortada pelo usuário." ? true : undefined,
                processingStatus: lastProcessingStatusRef.current || undefined,
                rawParts: accumulatedRawPartsRef.current.length > 0 ? [...accumulatedRawPartsRef.current] : undefined,
            };

            if (streamError && finalMetadata.abortedByUser) { // If it was an abort error
                // Clear the text if it was an abort and no actual AI text was generated
                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: "",
                    metadata: finalMetadata
                });
            } else if (streamError && !finalMetadata.abortedByUser) { // If it was a non-abort error
                finalMetadata.error = streamError; // Pode ser string ou boolean
                finalMetadata.userFacingError = streamError;
                if (lastProcessingStatusRef.current && lastProcessingStatusRef.current.stage !== 'completed') {
                    finalMetadata.processingStatus = { ...lastProcessingStatusRef.current, stage: 'failed', error: streamError };
                }
                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: (finalAiResponseText || accumulatedTextRef.current).replace(/▍$/, ''),
                    metadata: finalMetadata
                });
            } else { // No error, stream finished successfully
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
                    text: (finalAiResponseText || accumulatedTextRef.current).replace(/▍$/, ''),
                    metadata: finalMetadata
                });
            }

            currentAiMessageIdRef.current = null;
            currentConversationIdRef.current = null;
            chunkQueueRef.current = [];
            accumulatedTextRef.current = "";
            lastProcessingStatusRef.current = null;
            accumulatedRawPartsRef.current = [];
            if (localAbortEditedMessageControllerRef.current && localAbortEditedMessageControllerRef.current.signal === signal) {
                localAbortEditedMessageControllerRef.current = null;
            }
            setIsProcessingEditedMessage(false);
            setIsGeneratingResponse(false);
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
            isGeneratingResponse,
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
