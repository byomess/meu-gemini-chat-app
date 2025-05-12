// src/contexts/ConversationContext.tsx
import React, { createContext, useContext, type ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
// Importe os tipos atualizados, incluindo MemoryActionType
import type { Conversation, Message, MessageMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from './AppSettingsContext';
import { useMemories } from './MemoryContext';
// A interface do chunk de geminiService mudou para incluir memoryOperations
import { streamMessageToGemini, type StreamedGeminiResponseChunk } from '../services/geminiService';

const CONVERSATIONS_KEY = 'geminiChat_conversations';
const ACTIVE_CONVERSATION_ID_KEY = 'geminiChat_activeConversationId';
const CHUNK_RENDER_INTERVAL_MS = 200;

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

const sortByUpdatedAtDesc = (a: Conversation, b: Conversation) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [conversations, setConversations] = useLocalStorage<Conversation[]>(CONVERSATIONS_KEY, []);
    const [activeId, setActiveId] = useLocalStorage<string | null>(ACTIVE_CONVERSATION_ID_KEY, null);
    const [isProcessingEditedMessage, setIsProcessingEditedMessage] = useState<boolean>(false);

    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const chunkQueueRef = useRef<string[]>([]);
    const accumulatedTextRef = useRef<string>("");
    const currentAiMessageIdRef = useRef<string | null>(null);
    const currentConversationIdRef = useRef<string | null>(null);
    const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const streamHasFinishedRef = useRef<boolean>(false);

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
        if (chunkQueueRef.current.length > 0 || !streamHasFinishedRef.current) {
            renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
        }
    }, [updateMessageInConversation]);


    useEffect(() => {
        return () => {
            if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        };
    }, []);

    const regenerateResponseForEditedMessage = useCallback(async (
        conversationId: string,
        editedMessageId: string,
        newText: string
    ): Promise<void> => {
        setIsProcessingEditedMessage(true);
        // settings e funções do memoryHook já estão desestruturadas no escopo do Provider

        chunkQueueRef.current = [];
        accumulatedTextRef.current = "";
        streamHasFinishedRef.current = false;
        if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
        renderIntervalRef.current = null;

        if (!settings.apiKey) {
            addMessageToConversation(conversationId, {
                text: "Erro: Chave de API não configurada.",
                sender: 'ai',
                metadata: { error: true }
            });
            setIsProcessingEditedMessage(false);
            return;
        }

        const conversationToUpdate = conversations.find(c => c.id === conversationId);
        if (!conversationToUpdate) {
            console.error("Conversa não encontrada para regeneração.");
            setIsProcessingEditedMessage(false);
            return;
        }

        const messageIndex = conversationToUpdate.messages.findIndex(msg => msg.id === editedMessageId);
        if (messageIndex === -1) {
            console.error("Mensagem editada não encontrada na conversa.");
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
            ).sort(sortByUpdatedAtDesc)
        );

        const newAiMessageId = addMessageToConversation(conversationId, {
            text: "", sender: 'ai', metadata: { isLoading: true }
        });

        if (!newAiMessageId) {
            console.error("Falha ao criar ID para nova mensagem da IA.");
            setIsProcessingEditedMessage(false);
            return;
        }

        currentAiMessageIdRef.current = newAiMessageId;
        currentConversationIdRef.current = conversationId;

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;
        let finalCleanedTextForMessage = "";

        if (!renderIntervalRef.current) {
            renderIntervalRef.current = setTimeout(processChunkQueue, CHUNK_RENDER_INTERVAL_MS);
        }

        try {
            const historyForAPI = updatedMessages.map(msg => ({ sender: msg.sender, text: msg.text }));
            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));

            for await (const streamResponse of streamMessageToGemini(
                settings.apiKey,
                historyForAPI.slice(0, -1),
                newText,
                [],
                currentGlobalMemoriesWithObjects,
                settings.geminiModelConfig, // Pass the modelConfig from settings
                `
Você é um assistente de IA prestativo e amigável.
Siga estas instruções RIGOROSAMENTE para gerenciar memórias sobre o usuário.

INSTRUÇÕES PARA GERENCIAR MEMÓRIAS (use estas tags ao FINAL da sua resposta, se aplicável):

1.  CRIAR NOVA MEMÓRIA: Se a ÚLTIMA MENSAGEM DO USUÁRIO contiver uma informação nova, factual e relevante que precise ser lembrada para o futuro, use a tag:
    [MEMORIZE: "conteúdo da nova memória aqui"]
    Seja muito seletivo. Não memorize perguntas, comentários triviais, ou suas próprias respostas. Foco em fatos sobre o usuário ou suas preferências explícitas.

2.  ATUALIZAR MEMÓRIA EXISTENTE: Se a ÚLTIMA MENSAGEM DO USUÁRIO corrigir ou atualizar diretamente uma memória listada no "CONHECIMENTO PRÉVIO", use a tag:
    [UPDATE_MEMORY original:"conteúdo EXATO da memória antiga como listada" new:"novo conteúdo completo para essa memória"]
    É CRUCIAL que o "conteúdo EXATO da memória antiga como listada" seja IDÊNTICO ao texto de uma das memórias fornecidas (sem o prefixo "Memória N:").

3.  REMOVER MEMÓRIA (Use com extrema cautela): Se uma memória se tornar completamente obsoleta ou irrelevante com base na ÚLTIMA MENSAGEM DO USUÁRIO, e não apenas precisar de uma atualização, você PODE sugerir sua remoção usando:
    [DELETE_MEMORY: "conteúdo EXATO da memória a ser removida como listada"]
    Esta ação deve ser rara. Prefira atualizar, se possível. Se não tiver certeza, pergunte ao usuário.

REGRAS IMPORTANTES:
-   As tags de memória ([MEMORIZE:...], [UPDATE_MEMORY:...], [DELETE_MEMORY:...]) DEVEM ser colocadas no final da sua resposta completa.
-   Essas tags NÃO DEVEM aparecer no texto visível ao usuário. Elas serão processadas internamente.
-   Se múltiplas operações de memória forem necessárias (ex: uma atualização e uma nova memória), liste cada tag separadamente, uma após a outra, no final.
-   Se NÃO houver NADA a memorizar, atualizar ou remover da ÚLTIMA MENSAGEM DO USUÁRIO, NÃO inclua NENHUMA dessas tags.
-   Sua resposta principal ao usuário deve ser natural, útil e direta. As operações de memória são uma funcionalidade de bastidor.

EXEMPLOS DE USO DAS TAGS DE MEMÓRIA:
(Suponha que o "CONHECIMENTO PRÉVIO" fornecido contenha: Memória 1: "O nome do tio do usuário é Carlos." e Memória 2: "A cor favorita do usuário é azul.")

Exemplo 1:
ÚLTIMA MENSAGEM DO USUÁRIO: "Na verdade, o nome do meu tio é Oscar."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [UPDATE_MEMORY original:"O nome do tio do usuário é Carlos." new:"O nome do tio do usuário é Oscar."]

Exemplo 2:
ÚLTIMA MENSAGEM DO USUÁRIO: "Eu gosto de jogar tênis aos sábados."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [MEMORIZE: "O usuário gosta de jogar tênis aos sábados."]

Exemplo 3:
ÚLTIMA MENSAGEM DO USUÁRIO: "Não gosto mais de azul, minha cor favorita agora é verde."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [UPDATE_MEMORY original:"A cor favorita do usuário é azul." new:"A cor favorita do usuário é verde."]

Exemplo 4:
ÚLTIMA MENSAGEM DO USUÁRIO: "Eu moro em São Paulo e meu hobby é cozinhar."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [MEMORIZE: "O usuário mora em São Paulo."][MEMORIZE: "O hobby do usuário é cozinhar."]

Exemplo 5 (Deleção):
(Suponha que o "CONHECIMENTO PRÉVIO" contenha: Memória 3: "O usuário tem um cachorro chamado Rex.")
ÚLTIMA MENSAGEM DO USUÁRIO: "Infelizmente, meu cachorro Rex faleceu semana passada."
SUA RESPOSTA (final): ...sua resposta normal ao usuário, expressando condolências... [DELETE_MEMORY: "O usuário tem um cachorro chamado Rex."]
                `
                // settings.systemInstruction // Pass the systemInstruction from settings
            )) {
                if (streamResponse.delta) {
                    chunkQueueRef.current.push(streamResponse.delta);
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    streamHasFinishedRef.current = true;
                    break;
                }
                if (streamResponse.isFinished) {
                    finalCleanedTextForMessage = streamResponse.finalText || accumulatedTextRef.current;
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    streamHasFinishedRef.current = true;
                    break;
                }
            }

            if (streamHasFinishedRef.current && chunkQueueRef.current.length > 0) {
                await new Promise(resolve => setTimeout(resolve, CHUNK_RENDER_INTERVAL_MS * (chunkQueueRef.current.length + 1.5)));
            } else if (streamHasFinishedRef.current) {
                await new Promise(resolve => setTimeout(resolve, CHUNK_RENDER_INTERVAL_MS * 1.5));
            }

            if (streamError) {
                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: (finalCleanedTextForMessage || accumulatedTextRef.current) +
                          ((finalCleanedTextForMessage || accumulatedTextRef.current) ? '\n\n--- ERRO ---\n' : '') +
                          streamError,
                    metadata: { isLoading: false, error: true }
                });
            } else {
                const processedMemoryActions: Required<MessageMetadata>['memorizedMemoryActions'] = [];

                if (memoryOperationsFromServer && memoryOperationsFromServer.length > 0) {
                    memoryOperationsFromServer.forEach(op => {
                        if (op.action === 'create' && op.content) {
                            const newMemoryObject = addMemory(op.content);
                            if (newMemoryObject) {
                                processedMemoryActions.push({
                                    id: newMemoryObject.id,
                                    content: newMemoryObject.content,
                                    action: 'created'
                                });
                            }
                        } else if (op.action === 'update' && op.targetMemoryContent && op.content) {
                            const memoryToUpdate = globalMemoriesFromHook.find(
                                mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase()
                            );
                            if (memoryToUpdate) {
                                updateMemory(memoryToUpdate.id, op.content); // Chama a função do MemoryContext
                                processedMemoryActions.push({
                                    id: memoryToUpdate.id,
                                    content: op.content, // Novo conteúdo
                                    originalContent: memoryToUpdate.content, // Conteúdo antigo
                                    action: 'updated'
                                });
                            } else {
                                console.warn(`IA tentou atualizar memória por conteúdo que não foi encontrada: "${op.targetMemoryContent}". Criando como nova memória.`);
                                // Fallback: criar como nova memória se a original não for encontrada.
                                const newMemoryObject = addMemory(op.content);
                                if (newMemoryObject) {
                                    processedMemoryActions.push({
                                        id: newMemoryObject.id,
                                        content: newMemoryObject.content,
                                        action: 'created' // Tratada como 'created' se a original não for achada
                                    });
                                }
                            }
                        } else if (op.action === 'delete_by_ai_suggestion' && op.targetMemoryContent) {
                            const memoryToDelete = globalMemoriesFromHook.find(
                                mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase()
                            );
                            if (memoryToDelete) {
                                deleteMemoryFromHook(memoryToDelete.id); // Chama a função do MemoryContext
                                processedMemoryActions.push({
                                    id: memoryToDelete.id,
                                    content: memoryToDelete.content, // Conteúdo que foi deletado
                                    originalContent: memoryToDelete.content,
                                    action: 'deleted_by_ai'
                                });
                            } else {
                                console.warn(`IA tentou deletar memória não encontrada pelo conteúdo: "${op.targetMemoryContent}"`);
                            }
                        }
                    });
                }

                updateMessageInConversation(conversationId, newAiMessageId, {
                    text: finalCleanedTextForMessage,
                    metadata: {
                        isLoading: false,
                        memorizedMemoryActions: processedMemoryActions.length > 0 ? processedMemoryActions : undefined,
                    }
                });
            }
        } catch (error) {
            console.error("Erro ao regenerar resposta:", error);
            updateMessageInConversation(conversationId, newAiMessageId, {
                text: (finalCleanedTextForMessage || accumulatedTextRef.current) + "\n\nErro ao processar a regeneração da resposta.",
                metadata: { isLoading: false, error: true }
            });
        } finally {
            if (renderIntervalRef.current) clearTimeout(renderIntervalRef.current);
            renderIntervalRef.current = null;
            currentAiMessageIdRef.current = null;
            currentConversationIdRef.current = null;
            chunkQueueRef.current = [];
            accumulatedTextRef.current = "";
            setIsProcessingEditedMessage(false);
        }
    }, [
        settings.apiKey,
        globalMemoriesFromHook, addMemory, updateMemory, deleteMemoryFromHook,
        conversations,
        setConversations,
        addMessageToConversation,
        updateMessageInConversation,
        processChunkQueue // Removido setActiveId pois não é usado diretamente aqui
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