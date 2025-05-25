/* eslint-disable @typescript-eslint/no-explicit-any */
// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Conversation, Message, MessageMetadata, ProcessingStatus, Part } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from './AppSettingsContext';
import { useMemories } from './MemoryContext';
import { streamMessageToGemini, type StreamedGeminiResponseChunk } from '../services/geminiService';
import { systemMessage } from '../prompts';

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';
const CHUNK_RENDER_INTERVAL_MS = 200;

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
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
    removeMessagesAfterId: (conversationId: string, messageId: string) => Conversation | null;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

const sortByUpdatedAtDesc = (a: Conversation, b: Conversation) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [conversations, setConversations] = useLocalStorage<Conversation[]>(CONVERSATIONS_KEY, []);
    const [activeId, setActiveId] = useLocalStorage<string | null>(ACTIVE_CONVERSATION_ID_KEY, null);

    const chunkQueueRef = useRef<string[]>([]);
    const accumulatedTextRef = useRef<string>("");
    const currentAiMessageIdRef = useRef<string | null>(null);
    const currentConversationIdRef = useRef<string | null>(null);
    const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const streamHasFinishedRef = useRef<boolean>(false);
    const lastProcessingStatusRef = useRef<ProcessingStatus | null>(null);
    const accumulatedRawPartsRef = useRef<Part[]>([]);

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

    const removeMessagesAfterId = useCallback((conversationId: string, messageId: string): Conversation | null => {
        let updatedConversation: Conversation | null = null;
        setConversations(prevConvos => {
            const newConvos = prevConvos.map(c => {
                if (c.id === conversationId) {
                    const messageIndex = c.messages.findIndex(msg => msg.id === messageId);
                    if (messageIndex === -1) {
                        return c;
                    }
                    const updatedMessages = c.messages.slice(0, messageIndex + 1);
                    const modifiedConversation = { ...c, messages: updatedMessages, updatedAt: new Date() };
                    updatedConversation = modifiedConversation;
                    return modifiedConversation;
                }
                return c;
            });
            return newConvos.sort(sortByUpdatedAtDesc);
        });
        return updatedConversation;
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
                chunkQueueRef.current = [];
                textToUpdate += chunkToRender;
                accumulatedTextRef.current = textToUpdate;
            }

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

            if (!streamHasFinishedRef.current || chunkQueueRef.current.length > 0) {
                renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
            } else {
                updateMessageInConversation(currentConversationIdRef.current, currentAiMessageIdRef.current, {
                    text: accumulatedTextRef.current,
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
        };
    }, []);

    return (
        <ConversationContext.Provider value={{
            conversations,
            activeConversationId: activeId,
            activeConversation,
            setActiveConversationId,
            createNewConversation,
            deleteConversation,
            deleteAllConversations,
            addMessageToConversation,
            updateMessageInConversation,
            updateConversationTitle,
            removeMessageById,
            removeMessagesAfterId,
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
