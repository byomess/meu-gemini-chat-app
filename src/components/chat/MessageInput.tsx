// src/components/chat/MessageInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import { IoSend, IoPulseOutline, IoWarningOutline } from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import { streamMessageToGemini } from '../../services/geminiService';

const MessageInput: React.FC = () => {
    const {
        activeConversationId,
        activeConversation,
        addMessageToConversation,
        updateMessageInConversation,
        isProcessingEditedMessage,
    } = useConversations();
    const { settings } = useAppSettings();
    const { memories: globalMemories, addMemory: addNewGlobalMemory } = useMemories();

    const [text, setText] = useState<string>('');
    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const MAX_TEXTAREA_HEIGHT = 160;

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
            textareaRef.current.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
        }
    };

    useEffect(() => {
        adjustTextareaHeight();
    }, [text]);

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

        addMessageToConversation(activeConversationId, { text: trimmedText, sender: 'user' });

        const currentTextForAI = trimmedText;
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

        let accumulatedResponse = "";
        let finalMemories: string[] = [];
        let streamError: string | null = null;

        try {
            const conversationHistoryForAPI = activeConversation?.messages
                .filter(msg => msg.id !== aiMessageId)
                .map(msg => ({ sender: msg.sender, text: msg.text })) || [];

            for await (const streamResponse of streamMessageToGemini(
                settings.apiKey,
                conversationHistoryForAPI,
                currentTextForAI,
                globalMemories.map(mem => mem.content)
            )) {
                if (streamResponse.delta) {
                    accumulatedResponse += streamResponse.delta;
                    updateMessageInConversation(activeConversationId, aiMessageId, {
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
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: streamError,
                    metadata: { isLoading: false, error: true }
                });
                setErrorFromAI(streamError);
            } else {
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: accumulatedResponse,
                    metadata: { isLoading: false, memorizedItems: finalMemories.length > 0 ? finalMemories : undefined }
                });

                if (finalMemories.length > 0) {
                    finalMemories.forEach(memContent => addNewGlobalMemory(memContent));
                    console.log("Novas memórias adicionadas:", finalMemories);
                }
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

        const hasLineBreakInText = text.includes('\n');

        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSubmit();
            return;
        }

        if (e.key === 'Enter' && e.shiftKey) {
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            if (!hasLineBreakInText) {
                e.preventDefault();
                handleSubmit();
            }
        }
    };

    const isOverallBusy = isLoadingAI || isProcessingEditedMessage;
    const canSubmit = text.trim().length > 0 && !!activeConversationId && !isOverallBusy;
    const isInputDisabled = !activeConversationId || !settings.apiKey || isOverallBusy;

    const placeholderText =
        isProcessingEditedMessage ? "Processando edição anterior..." :
            isLoadingAI ? "Gemini está respondendo..." :
                activeConversationId ?
                    (settings.apiKey ? "Digite sua mensagem... (Ctrl+Enter para enviar / Ctrl+Shift para quebrar linha)" : "Configure sua API Key nas Configurações.") :
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
