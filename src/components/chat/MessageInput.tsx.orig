// src/components/chat/MessageInput.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react'; // Adicionado useCallback
import Button from '../common/Button';
import { IoSend, IoPulseOutline, IoWarningOutline } from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import { streamMessageToGemini, type StreamedGeminiResponseChunk } from '../../services/geminiService';
import type { MessageMetadata } from '../../types';

const MessageInput: React.FC = () => {
    const {
        activeConversationId,
        addMessageToConversation,
        updateMessageInConversation,
        isProcessingEditedMessage,
        // Precisamos do array de conversas para pegar o estado mais recente
        conversations, 
    } = useConversations();
    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const [text, setText] = useState<string>('');
    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const MAX_TEXTAREA_HEIGHT = 160;

    const adjustTextareaHeight = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
            textareaRef.current.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
        }
    }, []); // useCallback pois não depende de props/state que mudam frequentemente

    useEffect(() => {
        adjustTextareaHeight();
    }, [text, adjustTextareaHeight]);

    useEffect(() => {
        if (activeConversationId && textareaRef.current && text === '' && !isLoadingAI && !isProcessingEditedMessage) {
            textareaRef.current.focus();
        }
    }, [activeConversationId, text, isLoadingAI, isProcessingEditedMessage]);

    useEffect(() => {
        if (text !== '' && errorFromAI) {
            setErrorFromAI(null);
        }
    }, [text, errorFromAI]);


    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorFromAI(null);
        const trimmedText = text.trim();

        if (!trimmedText || !activeConversationId || isLoadingAI || isProcessingEditedMessage) {
            return;
        }

        if (!settings.apiKey) {
            addMessageToConversation(activeConversationId, {
                text: "Erro: Chave de API não configurada. Por favor, adicione sua chave nas Configurações para interagir com a IA.",
                sender: 'ai',
                metadata: { error: true }
            });
            setText('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            return;
        }

        // Captura o histórico ANTES de adicionar a nova mensagem do usuário
        // Usa o array `conversations` do hook, que é o estado mais atualizado.
        const conversationForHistory = conversations.find(c => c.id === activeConversationId);
        const historyBeforeCurrentUserMessage = conversationForHistory?.messages.map(msg => ({
            sender: msg.sender,
            text: msg.text
        })) || [];
        
        const currentTextForAI = trimmedText; // Mensagem atual do usuário

        // Adiciona a mensagem do usuário ao estado (para a UI)
        // Esta chamada atualizará `conversations` e, consequentemente, `activeConversation` no próximo render,
        // mas `historyBeforeCurrentUserMessage` já foi capturado.
        addMessageToConversation(activeConversationId, { text: currentTextForAI, sender: 'user' });
        
        setText('');
        setIsLoadingAI(true);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }

        const aiMessageId = addMessageToConversation(activeConversationId, {
            text: "",
            sender: 'ai',
            metadata: { isLoading: true }
        });

        if (!aiMessageId) {
            console.error("Não foi possível criar a mensagem placeholder da IA.");
            setIsLoadingAI(false);
            setErrorFromAI("Erro interno ao tentar preparar a resposta da IA.");
            return;
        }

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;
        let finalCleanedTextForMessage = "";

        try {
            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));

            for await (const streamResponse of streamMessageToGemini(
                settings.apiKey,
                historyBeforeCurrentUserMessage, // Histórico ANTES da mensagem atual do usuário
                currentTextForAI,                // A mensagem atual do usuário
                currentGlobalMemoriesWithObjects
            )) {
                if (streamResponse.delta) {
                    finalCleanedTextForMessage += streamResponse.delta;
                    updateMessageInConversation(activeConversationId, aiMessageId, {
                        text: finalCleanedTextForMessage + "▍",
                        metadata: { isLoading: true }
                    });
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    break;
                }
                if (streamResponse.isFinished) {
                    finalCleanedTextForMessage = streamResponse.finalText || finalCleanedTextForMessage;
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }

            if (streamError) {
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: (finalCleanedTextForMessage || "") + 
                          ((finalCleanedTextForMessage) ? '\n\n--- ERRO ---\n' : '') + 
                          streamError,
                    metadata: { isLoading: false, error: true }
                });
                setErrorFromAI(streamError);
            } else {
                const processedMemoryActions: Required<MessageMetadata>['memorizedMemoryActions'] = [];

                if (memoryOperationsFromServer && memoryOperationsFromServer.length > 0) {
                    console.log("MESSAGE_INPUT: Processing operations:", memoryOperationsFromServer);
                    memoryOperationsFromServer.forEach(op => {
                        console.log("MESSAGE_INPUT: Current operation:", op);
                        if (op.action === 'create' && op.content) {
                            const newMemoryObject = addMemory(op.content);
                            console.log("MESSAGE_INPUT: addMemory called with content:", op.content, " ---- Resulting newMemoryObject:", newMemoryObject);
                            if (newMemoryObject) {
                                processedMemoryActions.push({
                                    id: newMemoryObject.id,
                                    content: newMemoryObject.content,
                                    action: 'created'
                                });
                            } else {
                                console.warn("MESSAGE_INPUT: addMemory returned undefined for content:", op.content);
                            }
                        } else if (op.action === 'update' && op.targetMemoryContent && op.content) {
                            const memoryToUpdate = globalMemoriesFromHook.find(
                                mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase()
                            );
                            if (memoryToUpdate) {
                                updateMemory(memoryToUpdate.id, op.content);
                                processedMemoryActions.push({
                                    id: memoryToUpdate.id,
                                    content: op.content,
                                    originalContent: memoryToUpdate.content,
                                    action: 'updated'
                                });
                            } else {
                                console.warn(`MESSAGE_INPUT: IA tentou atualizar memória não encontrada: "${op.targetMemoryContent}". Criando como nova.`);
                                const newMemoryObject = addMemory(op.content);
                                if (newMemoryObject) {
                                    processedMemoryActions.push({
                                        id: newMemoryObject.id,
                                        content: newMemoryObject.content,
                                        action: 'created'
                                    });
                                }
                            }
                        } else if (op.action === 'delete_by_ai_suggestion' && op.targetMemoryContent) {
                            const memoryToDelete = globalMemoriesFromHook.find(
                                mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase()
                            );
                            if (memoryToDelete) {
                                deleteMemoryFromHook(memoryToDelete.id);
                                processedMemoryActions.push({
                                    id: memoryToDelete.id,
                                    content: memoryToDelete.content,
                                    originalContent: memoryToDelete.content,
                                    action: 'deleted_by_ai'
                                });
                            } else {
                                console.warn(`MESSAGE_INPUT: IA tentou deletar memória não encontrada: "${op.targetMemoryContent}"`);
                            }
                        }
                    });
                }
                console.log("MESSAGE_INPUT: Final processedMemoryActions:", processedMemoryActions);

                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: finalCleanedTextForMessage,
                    metadata: { 
                        isLoading: false, 
                        memorizedMemoryActions: processedMemoryActions.length > 0 ? processedMemoryActions : undefined,
                    }
                });
            }

        } catch (error: unknown) {
            console.error("Falha catastrófica ao processar stream com Gemini:", error);
            const clientErrorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu uma falha desconhecida no processamento da resposta.";
            updateMessageInConversation(activeConversationId, aiMessageId, {
                text: clientErrorMessage,
                metadata: { isLoading: false, error: true }
            });
            setErrorFromAI(clientErrorMessage);
        } finally {
            setIsLoadingAI(false);
            if (textareaRef.current && settings.apiKey && !streamError && !errorFromAI && !isProcessingEditedMessage) {
                textareaRef.current.focus();
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isLoadingAI || isProcessingEditedMessage) {
            if (e.key === 'Enter') e.preventDefault();
            return;
        }

        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isOverallBusy = isLoadingAI || isProcessingEditedMessage;
    const canSubmit = text.trim().length > 0 && !!activeConversationId && !isOverallBusy;
    const isInputDisabled = !activeConversationId || !settings.apiKey || isOverallBusy;

    const placeholderText =
        isProcessingEditedMessage ? "Processando edição anterior..." :
            isLoadingAI ? "Gemini está respondendo..." :
                activeConversationId ?
                    (settings.apiKey ? "Digite sua mensagem... (Ctrl+Enter para enviar / Enter para quebrar linha)" : "Configure sua API Key nas Configurações.") :
                    "Selecione ou crie uma conversa.";

    return (
        <div className="px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 border-t border-slate-700/60 bg-slate-800/90 backdrop-blur-sm sticky bottom-0">
            {errorFromAI && (
                <div className="mb-2 p-2 text-xs text-red-400 bg-red-900/30 rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0" />
                    <span>{errorFromAI}</span>
                </div>
            )}
            <form
                onSubmit={handleSubmit}
                className="flex items-end bg-slate-900/80 rounded-xl p-1.5 pr-2 shadow-md focus-within:ring-2 focus-within:ring-blue-500/70 transition-shadow duration-200"
            >
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholderText}
                    className="flex-1 bg-transparent text-slate-100 focus:outline-none px-3 py-2.5 resize-none leading-tight scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
                    style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
                    disabled={isInputDisabled}
                    aria-label="Campo de entrada de mensagem"
                />
                <Button
                    type="submit"
                    variant="primary"
                    className="ml-2 !p-2 sm:!p-2.5 rounded-lg"
                    disabled={!canSubmit}
                    aria-label="Enviar mensagem"
                >
                    {isOverallBusy ? (
                        <IoPulseOutline size={18} className="animate-pulse" />
                    ) : (
                        <IoSend size={18} />
                    )}
                </Button>
            </form>
            {!settings.apiKey && activeConversationId && !isOverallBusy && !errorFromAI && (
                <p className="text-xs text-yellow-400/90 text-center mt-2 px-2">
                    Chave de API não configurada. Por favor, adicione sua chave nas <strong className="font-medium">Configurações</strong> para interagir com a IA.
                </p>
            )}
        </div>
    );
};

export default MessageInput;