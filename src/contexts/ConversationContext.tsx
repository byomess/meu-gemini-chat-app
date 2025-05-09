// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useState as useReactState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Conversation, Message, MessageMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from './AppSettingsContext';
import { useMemories } from './MemoryContext';
import { streamMessageToGemini } from '../services/geminiService';

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';
const CHUNK_RENDER_INTERVAL_MS = 200; // Intervalo para renderizar chunks da fila

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
    isProcessingEditedMessage: boolean;
    setActiveConversationId: (id: string | null) => void;
    createNewConversation: () => Conversation;
    deleteConversation: (id: string) => void;
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
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [conversations, setConversations] = useLocalStorage<Conversation[]>(CONVERSATIONS_KEY, []);
    const [activeId, setActiveId] = useLocalStorage<string | null>(ACTIVE_CONVERSATION_ID_KEY, null);
    const [isProcessingEditedMessage, setIsProcessingEditedMessage] = useReactState<boolean>(false);

    const appSettingsHook = useAppSettings();
    const memoriesHook = useMemories();

    const chunkQueueRef = useRef<string[]>([]);
    const accumulatedTextRef = useRef<string>("");
    const currentAiMessageIdRef = useRef<string | null>(null);
    const currentConversationIdRef = useRef<string | null>(null);
    const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const streamHasFinishedRef = useRef<boolean>(false); // Nova ref para indicar fim do stream da API

    const activeConversation = conversations.find(c => c.id === activeId) || null;

    const setActiveConversationId = useCallback((id: string | null) => {
        setActiveId(id);
    }, [setActiveId]);

    const createNewConversation = useCallback((): Conversation => {
        const newConversation: Conversation = {
            id: uuidv4(),
            title: 'Nova Conversa',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setConversations(prev => [newConversation, ...prev].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        setActiveId(newConversation.id);
        return newConversation;
    }, [setConversations, setActiveId]);

    const deleteConversation = useCallback((id: string) => {
        const updatedConversations = conversations.filter(c => c.id !== id);
        setConversations(updatedConversations);
        if (activeId === id) {
            if (updatedConversations.length > 0) {
                const sortedRemaining = [...updatedConversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                setActiveId(sortedRemaining[0].id);
            } else {
                setActiveId(null);
            }
        }
    }, [conversations, activeId, setConversations, setActiveId]);

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
            ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
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
            ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
    }, [setConversations]);

    const removeMessageById = useCallback((conversationId: string, messageId: string) => {
        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: c.messages.filter(m => m.id !== messageId), updatedAt: new Date() }
                    : c
            ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
    }, [setConversations]);

    const updateConversationTitle = useCallback((id: string, newTitle: string) => {
        setConversations(prev =>
            prev.map(c =>
                c.id === id ? { ...c, title: newTitle, updatedAt: new Date() } : c
            ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
    }, [setConversations]);

    const processChunkQueue = useCallback(() => {
        if (renderIntervalRef.current) {
            clearTimeout(renderIntervalRef.current); // Limpa timer anterior
            renderIntervalRef.current = null;
        }

        if (chunkQueueRef.current.length > 0 && currentAiMessageIdRef.current && currentConversationIdRef.current) {
            const chunkToRender = chunkQueueRef.current.shift();
            if (chunkToRender) {
                accumulatedTextRef.current += chunkToRender;
                updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                    text: accumulatedTextRef.current + "▍",
                    metadata: { isLoading: true }
                });
            }
        }

        // Se ainda há chunks ou o stream da API não terminou (para pegar os últimos chunks), continua
        if (chunkQueueRef.current.length > 0 || !streamHasFinishedRef.current) {
            renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
        } else {
            // A fila está vazia E o stream da API terminou. Agora podemos fazer a atualização final.
            // A atualização final será feita na função `regenerateResponseForEditedMessage`
            // após este loop de `processChunkQueue` naturalmente se encerrar.
        }
    }, [updateMessageInConversation]);


    useEffect(() => {
        return () => {
            if (renderIntervalRef.current) {
                clearTimeout(renderIntervalRef.current);
            }
        };
    }, []);

    const regenerateResponseForEditedMessage = useCallback(async (
        conversationId: string,
        editedMessageId: string,
        newText: string
    ): Promise<void> => {
        setIsProcessingEditedMessage(true);
        const { settings } = appSettingsHook;
        const { memories: globalMemories, addMemory: addNewGlobalMemory } = memoriesHook;

        chunkQueueRef.current = [];
        accumulatedTextRef.current = "";
        streamHasFinishedRef.current = false; // Importante resetar
        if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        renderIntervalRef.current = null;

        if (!settings.apiKey) {
            addMessageToConversation(conversationId, {
                text: "Erro: Chave de API não configurada para regenerar resposta.",
                sender: 'ai',
                metadata: { error: true }
            });
            setIsProcessingEditedMessage(false);
            return;
        }

        const currentConversations = [...conversations]; // Cria uma cópia para trabalhar
        const conversationToUpdate = currentConversations.find(c => c.id === conversationId);

        if (!conversationToUpdate) {
            setIsProcessingEditedMessage(false);
            return;
        }

        const messageIndex = conversationToUpdate.messages.findIndex(msg => msg.id === editedMessageId);
        if (messageIndex === -1) {
            setIsProcessingEditedMessage(false);
            return;
        }

        const updatedMessages = conversationToUpdate.messages.slice(0, messageIndex + 1);
        updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            text: newText,
            timestamp: new Date(),
        };

        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: updatedMessages, updatedAt: new Date() }
                    : c
            ).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
        
        const newAiMessageId = addMessageToConversation(conversationId, {
            text: "",
            sender: 'ai',
            metadata: { isLoading: true }
        });

        if (!newAiMessageId) {
            setIsProcessingEditedMessage(false);
            return;
        }

        currentAiMessageIdRef.current = newAiMessageId;
        currentConversationIdRef.current = conversationId;

        let finalMemories: string[] = [];
        let streamError: string | null = null;
        
        // Inicia o processador da fila pela primeira vez (se houver chunks ou o stream não terminou)
        // Isso garante que mesmo que o primeiro chunk demore um pouco, o timer será iniciado.
        if (!renderIntervalRef.current) {
            renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
        }

        try {
            const historyForAPI = updatedMessages.map(msg => ({ sender: msg.sender, text: msg.text }));

            for await (const streamResponse of streamMessageToGemini(
                settings.apiKey,
                historyForAPI.slice(0, -1),
                newText,
                globalMemories.map(mem => mem.content)
            )) {
                if (streamResponse.delta) {
                    chunkQueueRef.current.push(streamResponse.delta);
                    // Não precisa chamar processChunkQueue aqui, o setTimeout já está agendado ou será agendado
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    streamHasFinishedRef.current = true; // Marca que o stream (com erro) terminou
                    break;
                }
                if (streamResponse.isFinished) {
                    finalMemories = streamResponse.newMemories || [];
                    streamHasFinishedRef.current = true; // Marca que o stream terminou
                    break; 
                }
            }
            
            // Esperar a fila de renderização terminar APÓS o stream ter finalizado completamente
            // Esta é a parte mais delicada. Se o streamHasFinishedRef.current for true,
            // o processChunkQueue irá parar de se reagendar quando a fila estiver vazia.
            // Precisamos de uma forma de saber quando a última atualização de UI via processChunkQueue aconteceu.

            // Simplificação: a atualização final ocorrerá no finally.
            // A `processChunkQueue` continuará até esvaziar a fila.
            // Quando o stream termina (streamHasFinishedRef.current = true), 
            // e a chunkQueueRef.current.length se torna 0, o timer para.
            // Nesse ponto, accumulatedTextRef.current terá o texto completo.

            // Pequena espera para dar chance ao último chunk ser processado pela fila do timer
            if(streamHasFinishedRef.current) {
                await new Promise(resolve => setTimeout(resolve, CHUNK_RENDER_INTERVAL_MS * 1.5));
            }


            if (streamError) {
                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: accumulatedTextRef.current + (accumulatedTextRef.current ? '\n\n--- ERRO ---\n' : '') + streamError,
                    metadata: { isLoading: false, error: true }
                });
            } else {
                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: accumulatedTextRef.current,
                    metadata: { isLoading: false, memorizedItems: finalMemories.length > 0 ? finalMemories : undefined }
                });
                if (finalMemories.length > 0) {
                    finalMemories.forEach(memContent => addNewGlobalMemory(memContent));
                }
            }
        } catch (error) {
            console.error("Erro ao regenerar resposta:", error);
            updateMessageInConversation(conversationId, newAiMessageId, {
                text: accumulatedTextRef.current + "\n\nErro ao processar a regeneração da resposta.",
                metadata: { isLoading: false, error: true }
            });
        } finally {
            if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
            renderIntervalRef.current = null;
            currentAiMessageIdRef.current = null;
            currentConversationIdRef.current = null;
            chunkQueueRef.current = []; // Limpa a fila para garantir
            accumulatedTextRef.current = ""; // Limpa o acumulador
            setIsProcessingEditedMessage(false);
        }
    }, [
        appSettingsHook, 
        memoriesHook, 
        conversations,
        setConversations, 
        addMessageToConversation, 
        updateMessageInConversation,
        processChunkQueue 
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
            addMessageToConversation,
            updateMessageInConversation,
            updateConversationTitle,
            removeMessageById,
            regenerateResponseForEditedMessage,
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