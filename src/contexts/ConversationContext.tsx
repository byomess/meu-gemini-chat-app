/* eslint-disable @typescript-eslint/no-explicit-any */
// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useCallback, useRef, useEffect } from 'react'; // Added useRef, useEffect
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Conversation, Message, MessageMetadata } from '../types'; // Removed useEffect, ProcessingStatus, Part; Removed RawImportedConversation
import { v4 as uuidv4 } from 'uuid';

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';
// const CHUNK_RENDER_INTERVAL_MS = 200; // This constant is no longer used but kept for now as it's not directly harmful. // Removed unused constant

// Helper to parse dates during JSON.parse for conversations
const conversationReviver = (key: string, value: unknown): unknown => {
    if (value && typeof value === 'string') {
        // Check for keys that are expected to be dates in Conversation or Message
        if (key === 'createdAt' || key === 'updatedAt' || key === 'timestamp') {
            // Basic ISO 8601 date string check (simplified, adjust if more specific format is needed)
            const dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.exec(value);
            if (dateMatch) {
                return new Date(value);
            }
        }
    }
    return value;
};

interface ConversationContextType {
    conversations: Conversation[]; // This will be the filtered list (non-deleted)
    activeConversationId: string | null;
    activeConversation: Conversation | null; // This will be the filtered one
    allConversations: Conversation[]; // ADDED: The full list including soft-deleted
    lastConversationChangeSourceRef: React.RefObject<'user' | 'sync' | 'ai_finished' | null>; // MODIFIED: Added 'ai_finished'
    resetLastConversationChangeSource: () => void; // ADDED
    setActiveConversationId: (id: string | null) => void;
    createNewConversation: (options?: { isIncognito?: boolean }) => Conversation; // Modified signature
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
    replaceAllConversations: (newConversations: Conversation[], source?: string) => void; // ADDED
    clearMessagesInConversation: (conversationId: string) => void; // ADDED
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

const sortByUpdatedAtDesc = (a: Conversation, b: Conversation) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [allConversations, setAllConversations] = useLocalStorage<Conversation[]>(CONVERSATIONS_KEY, [], conversationReviver); // MODIFIED: Renamed and added reviver
    const [activeId, setActiveId] = useLocalStorage<string | null>(ACTIVE_CONVERSATION_ID_KEY, null);

    const lastConversationChangeSourceRef = useRef<'user' | 'sync' | 'ai_finished' | null>(null); // MODIFIED: Added 'ai_finished'

    // Filtered conversations for UI consumption (non-deleted and sorted)
    const uiVisibleConversations = allConversations.filter(c => !c.isDeleted).sort(sortByUpdatedAtDesc);

    const activeConversation = uiVisibleConversations.find(c => c.id === activeId) || null;

    const resetLastConversationChangeSource = useCallback(() => { // ADDED
        lastConversationChangeSourceRef.current = null;
    }, []);

    const setActiveConversationId = useCallback((id: string | null) => {
        // Ensure the ID being set as active corresponds to a non-deleted conversation
        if (id && !allConversations.find(c => c.id === id && !c.isDeleted)) {
            setActiveId(null); // Reset if the target conversation is deleted or doesn't exist
            return;
        }
        setActiveId(id);
    }, [setActiveId, allConversations]);

    const createNewConversation = useCallback((options?: { isIncognito?: boolean }): Conversation => { // Modified to accept options
        const newConversation: Conversation = {
            id: uuidv4(),
            title: 'Nova Conversa',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            isIncognito: options?.isIncognito || false, // Set incognito status
            isDeleted: false, // Ensure new conversations are not deleted
        };
        setAllConversations(prev => [newConversation, ...prev].sort(sortByUpdatedAtDesc));
        setActiveId(newConversation.id);
        lastConversationChangeSourceRef.current = 'user'; // Keep: Creating a new conversation is a user action
        return newConversation;
    }, [setAllConversations, setActiveId]);

    const deleteConversation = useCallback((id: string) => {
        setAllConversations(prev =>
            prev.map(c =>
                c.id === id ? { ...c, isDeleted: true, updatedAt: new Date() } : c
            ).sort(sortByUpdatedAtDesc)
        );
        if (activeId === id) {
            // Find the next available non-deleted conversation to set as active
            const nextActiveConversations = allConversations.filter(c => c.id !== id && !c.isDeleted).sort(sortByUpdatedAtDesc);
            setActiveId(nextActiveConversations.length > 0 ? nextActiveConversations[0].id : null);
        }
        lastConversationChangeSourceRef.current = 'user'; // Keep: Deleting a conversation is a user action
    }, [activeId, setAllConversations, setActiveId, allConversations]); // allConversations needed for finding next active

    const deleteAllConversations = useCallback(() => {
        setAllConversations(prev =>
            prev.map(c =>
                !c.isDeleted ? { ...c, isDeleted: true, updatedAt: new Date() } : c
            ).sort(sortByUpdatedAtDesc)
        );
        setActiveId(null);
        lastConversationChangeSourceRef.current = 'user'; // Keep: Deleting all conversations is a user action
    }, [setAllConversations, setActiveId]);

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
        setAllConversations(prevConvos => // MODIFIED: setAllConversations
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
        // lastConversationChangeSourceRef.current = 'user'; // REMOVED: Adding a message (especially user's) should not trigger sync
        return newMessageId;
    }, [setAllConversations]);

    const updateMessageInConversation = useCallback((
        conversationId: string,
        messageId: string,
        updates: { text?: string; metadata?: Partial<MessageMetadata> }
    ) => {
        setAllConversations(prevConvos => // MODIFIED: setAllConversations
            prevConvos.map(c =>
                c.id === conversationId
                    ? {
                        ...c,
                        messages: c.messages.map(msg => {
                            if (msg.id === messageId) {
                                const updatedMsg = {
                                    ...msg,
                                    ...(updates.text !== undefined && { text: updates.text }),
                                    ...(updates.metadata && { metadata: { ...msg.metadata, ...updates.metadata } }),
                                    timestamp: new Date()
                                };

                                // If this is a model message and its loading state changes to false or an error appears
                                // AND it was NOT aborted by the user
                                if (updatedMsg.sender === 'model' && msg.metadata?.isLoading === true &&
                                    (updates.metadata?.isLoading === false || updates.metadata?.error !== undefined) &&
                                    !updates.metadata?.abortedByUser // ADDED: Don't trigger if aborted
                                ) {
                                    lastConversationChangeSourceRef.current = 'ai_finished';
                                }
                                // If this is a user message and its text is being updated (user editing their message)
                                else if (updatedMsg.sender === 'user' && updates.text !== undefined && updates.text !== msg.text) {
                                    lastConversationChangeSourceRef.current = 'user';
                                }
                                return updatedMsg;
                            }
                            return msg;
                        }),
                        updatedAt: new Date(),
                    }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );
    }, [setAllConversations]);

    const removeMessagesAfterId = useCallback((conversationId: string, messageId: string): Conversation | null => {
        let updatedConversation: Conversation | null = null;
        setAllConversations(prevConvos => {
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
        lastConversationChangeSourceRef.current = 'user'; // Keep: User action
        return updatedConversation;
    }, [setAllConversations]);

    const removeMessageById = useCallback((conversationId: string, messageId: string) => {
        setAllConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: c.messages.filter(m => m.id !== messageId), updatedAt: new Date() }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );
        lastConversationChangeSourceRef.current = 'user'; // Keep: User action
    }, [setAllConversations]);

    const updateConversationTitle = useCallback((id: string, newTitle: string) => {
        setAllConversations(prev =>
            prev.map(c =>
                c.id === id ? { ...c, title: newTitle, updatedAt: new Date() } : c
            ).sort(sortByUpdatedAtDesc)
        );
        lastConversationChangeSourceRef.current = 'user'; // Keep: User action
    }, [setAllConversations]);

    const replaceAllConversations = useCallback((newConversations: Conversation[], source?: string) => {
        const processedConversations = newConversations.map(conv => ({
            ...conv,
            createdAt: new Date(conv.createdAt), // Ensure Date objects
            updatedAt: new Date(conv.updatedAt), // Ensure Date objects
            messages: conv.messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp) // Ensure Date objects
            })),
            isDeleted: conv.isDeleted || false,
        })).sort(sortByUpdatedAtDesc);

        setAllConversations(processedConversations);

        if (source === 'sync') {
            lastConversationChangeSourceRef.current = 'sync';
        } else {
            lastConversationChangeSourceRef.current = 'user'; // Or null if preferred for non-sync replacements
        }
        // Potentially re-evaluate activeId if it points to a now-deleted or non-existent conversation
        if (activeId && !processedConversations.find(c => c.id === activeId && !c.isDeleted)) {
            const nextActive = processedConversations.find(c => !c.isDeleted);
            setActiveId(nextActive ? nextActive.id : null);
        }

    }, [setAllConversations, activeId, setActiveId]);

    const clearMessagesInConversation = useCallback((conversationId: string) => {
        setAllConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: [], updatedAt: new Date() }
                    : c
            ).sort(sortByUpdatedAtDesc)
        );
        lastConversationChangeSourceRef.current = 'user'; // Clearing messages is a user action
    }, [setAllConversations]);


    // The useEffect hook for clearing renderIntervalRef is removed as it's no longer needed.

    // Effect to initialize conversation state:
    // - If no visible conversations exist, creates a new one.
    // - Ensures a valid conversation is active if conversations do exist.
    useEffect(() => {
        console.log('[ContextEffect] Running. ActiveID:', activeId, 'uiVisibleConversations count:', uiVisibleConversations.length, 'allConversations count:', allConversations.length);
        // uiVisibleConversations is already filtered for non-deleted and sorted by updatedAt descending.
        if (uiVisibleConversations.length > 0) {
            // Visible conversations exist. Ensure one is active if current activeId is null or invalid.
            // An activeId is valid if it's in uiVisibleConversations OR if it's in allConversations and not deleted
            // (this covers the case where uiVisibleConversations might be stale after a new conversation is created).
            const currentActiveIsValid = activeId !== null &&
                (uiVisibleConversations.some(c => c.id === activeId) ||
                 allConversations.some(c => c.id === activeId && !c.isDeleted));

            console.log('[ContextEffect] currentActiveIsValid:', currentActiveIsValid, 'Current activeId:', activeId);

            if (!currentActiveIsValid) {
                // If current activeId is truly invalid (e.g., points to a deleted convo or is null),
                // set the most recent visible conversation as active.
                const newActiveId = uiVisibleConversations[0].id;
                console.log('[ContextEffect] currentActiveIsValid is false. Setting active conversation to (most recent visible):', newActiveId);
                setActiveConversationId(newActiveId);
            } else {
                console.log('[ContextEffect] currentActiveIsValid is true. Active ID remains:', activeId);
            }
        } else {
            // No visible conversations exist.
            // However, check if allConversations has items that are all marked as deleted.
            // If activeId is null and there are no truly visible conversations, create a new one.
            if (allConversations.every(c => c.isDeleted)) {
                console.log('[ContextEffect] No visible conversations (all are deleted or list is empty), creating new one.');
                createNewConversation();
            } else if (!activeId && uiVisibleConversations.length === 0 && allConversations.length > 0) {
                // This case might occur if all conversations were soft-deleted and then one was "undeleted" by sync,
                // but uiVisibleConversations hasn't caught up. Or if activeId was explicitly set to null.
                // If there are non-deleted items in allConversations but uiVisible is empty, this indicates a transitional state.
                // Let's be cautious and if activeId is null, pick the first non-deleted from allConversations.
                const firstNonDeletedInAll = allConversations.find(c => !c.isDeleted);
                if (firstNonDeletedInAll) {
                    console.log('[ContextEffect] No visible conversations in uiVisible, but found non-deleted in allConversations. Setting active to:', firstNonDeletedInAll.id);
                    setActiveConversationId(firstNonDeletedInAll.id);
                } else {
                    console.log('[ContextEffect] No visible conversations and no non-deleted in allConversations. Creating new one.');
                    createNewConversation();
                }
            } else if (!activeId && uiVisibleConversations.length === 0 && allConversations.length === 0) {
                 console.log('[ContextEffect] No conversations at all. Creating new one.');
                 createNewConversation();
            } else {
                console.log('[ContextEffect] No visible conversations, but activeId is somehow set or allConversations is not empty. State:', activeId, uiVisibleConversations.length, allConversations.length);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uiVisibleConversations, allConversations, activeId, setActiveConversationId]); // Added allConversations, removed createNewConversation

    return (
        <ConversationContext.Provider value={{
            conversations: uiVisibleConversations,
            activeConversationId: activeId,
            activeConversation,
            allConversations, // ADDED
            lastConversationChangeSourceRef, // ADDED
            resetLastConversationChangeSource, // ADDED
            setActiveConversationId, // This is the wrapped setter
            createNewConversation,
            deleteConversation,
            deleteAllConversations,
            addMessageToConversation,
            updateMessageInConversation,
            updateConversationTitle,
            removeMessageById,
            removeMessagesAfterId,
            replaceAllConversations, // ADDED
            clearMessagesInConversation, // ADDED
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
