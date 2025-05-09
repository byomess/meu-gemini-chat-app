// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useState as useReactState } from 'react'; // Renomear useState para evitar conflito
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Conversation, Message, MessageMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';
// Importar os hooks necessários para a chamada da API dentro do contexto
import { useAppSettings } from './AppSettingsContext';
import { useMemories } from './MemoryContext';
import { streamMessageToGemini } from '../services/geminiService';

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
    isProcessingEditedMessage: boolean; // Novo estado para feedback de UI
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
    regenerateResponseForEditedMessage: ( // Nova função
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


    // Dependências para a chamada da API
    const appSettingsHook = useAppSettings(); // Chamado aqui para estar no corpo do provider
    const memoriesHook = useMemories();     // Chamado aqui

    const activeConversation = conversations.find(c => c.id === activeId) || null;

    const setActiveConversationId = (id: string | null) => {
        setActiveId(id);
    };

    const createNewConversation = (): Conversation => {
        // ... (sem alterações)
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
    };

    const deleteConversation = (id: string) => {
        // ... (sem alterações)
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
    };

    const addMessageToConversation = (
        conversationId: string,
        messageContent: Omit<Message, 'id' | 'timestamp'>
    ): string => {
        // ... (sem alterações)
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
    };

    const updateMessageInConversation = (
        conversationId: string,
        messageId: string,
        updates: { text?: string; metadata?: Partial<MessageMetadata> }
    ) => {
        // ... (sem alterações)
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
    };

    const removeMessageById = (conversationId: string, messageId: string) => {
        // ... (sem alterações)
        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: c.messages.filter(m => m.id !== messageId), updatedAt: new Date() } // Adiciona updatedAt
                    : c
            ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
    };

    const updateConversationTitle = (id: string, newTitle: string) => {
        // ... (sem alterações)
        setConversations(prev =>
            prev.map(c =>
                c.id === id ? { ...c, title: newTitle, updatedAt: new Date() } : c
            ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
    };

    // NOVA FUNÇÃO
    const regenerateResponseForEditedMessage = async (
        conversationId: string,
        editedMessageId: string,
        newText: string
    ): Promise<void> => {
        setIsProcessingEditedMessage(true);
        const { settings } = appSettingsHook; // Obtém settings do hook
        const { memories: globalMemories, addMemory: addNewGlobalMemory } = memoriesHook; // Obtém memories do hook

        if (!settings.apiKey) {
            addMessageToConversation(conversationId, {
                text: "Erro: Chave de API não configurada para regenerar resposta.",
                sender: 'ai',
                metadata: { error: true }
            });
            setIsProcessingEditedMessage(false);
            return;
        }

        let conversationToUpdate = conversations.find(c => c.id === conversationId);
        if (!conversationToUpdate) {
            console.error("Conversa não encontrada para regeneração.");
            setIsProcessingEditedMessage(false);
            return;
        }

        const messageIndex = conversationToUpdate.messages.findIndex(msg => msg.id === editedMessageId);
        if (messageIndex === -1) {
            console.error("Mensagem editada não encontrada para regeneração.");
            setIsProcessingEditedMessage(false);
            return;
        }

        // 1. Atualiza a mensagem do usuário e remove as subsequentes
        const updatedMessages = conversationToUpdate.messages.slice(0, messageIndex + 1);
        updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            text: newText,
            timestamp: new Date(), // Atualiza o timestamp da mensagem editada
        };

        setConversations(prevConvos =>
            prevConvos.map(c =>
                c.id === conversationId
                    ? { ...c, messages: updatedMessages, updatedAt: new Date() }
                    : c
            ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );

        // A conversa foi atualizada, precisamos pegar a referência mais recente para o histórico da API
        conversationToUpdate = conversations.find(c => c.id === conversationId);
        if (!conversationToUpdate) { // Checagem de segurança, improvável de falhar
            setIsProcessingEditedMessage(false);
            return;
        }


        // 2. Adiciona uma mensagem placeholder para a nova resposta da IA
        const newAiMessageId = addMessageToConversation(conversationId, {
            text: "",
            sender: 'ai',
            metadata: { isLoading: true }
        });

        if (!newAiMessageId) {
            console.error("Não foi possível criar a mensagem placeholder da IA para regeneração.");
            setIsProcessingEditedMessage(false);
            return;
        }

        let accumulatedResponse = "";
        let finalMemories: string[] = [];
        let streamError: string | null = null;

        try {
            // O histórico para a API agora são as `updatedMessages` (até a mensagem editada inclusive)
            const historyForAPI = updatedMessages.map(msg => ({ sender: msg.sender, text: msg.text }));

            for await (const streamResponse of streamMessageToGemini(
                settings.apiKey,
                historyForAPI.slice(0, -1), // Todo o histórico EXCETO a última mensagem do usuário (editada)
                newText,                     // A mensagem do usuário (editada) como a atual
                globalMemories.map(mem => mem.content)
            )) {
                if (streamResponse.delta) {
                    accumulatedResponse += streamResponse.delta;
                    updateMessageInConversation(conversationId, newAiMessageId, {
                        text: accumulatedResponse + "▍",
                        metadata: { isLoading: true }
                    });
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    break;
                }
                if (streamResponse.isFinished) {
                    accumulatedResponse = streamResponse.finalText || accumulatedResponse;
                    finalMemories = streamResponse.newMemories || [];
                    break;
                }
            }

            if (streamError) {
                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: streamError,
                    metadata: { isLoading: false, error: true }
                });
            } else {
                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: accumulatedResponse,
                    metadata: { isLoading: false, memorizedItems: finalMemories.length > 0 ? finalMemories : undefined }
                });
                if (finalMemories.length > 0) {
                    finalMemories.forEach(memContent => addNewGlobalMemory(memContent));
                }
            }
        } catch (error) {
            console.error("Erro ao regenerar resposta:", error);
            updateMessageInConversation(conversationId, newAiMessageId, {
                text: "Erro ao processar a regeneração da resposta.",
                metadata: { isLoading: false, error: true }
            });
        } finally {
            setIsProcessingEditedMessage(false);
        }
    };


    return (
        <ConversationContext.Provider value={{
            conversations,
            activeConversationId: activeId,
            activeConversation,
            isProcessingEditedMessage, // Expor o novo estado
            setActiveConversationId,
            createNewConversation,
            deleteConversation,
            addMessageToConversation,
            updateMessageInConversation,
            updateConversationTitle,
            removeMessageById,
            regenerateResponseForEditedMessage, // Expor a nova função
        }}>
            {children}
        </ConversationContext.Provider>
    );
};

// Hook useConversations permanece o mesmo
export const useConversations = (): ConversationContextType => {
    const context = useContext(ConversationContext);
    if (context === undefined) {
        throw new Error('useConversations must be used within a ConversationProvider');
    }
    return context;
};
