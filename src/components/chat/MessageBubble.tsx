// src/components/chat/MessageBubble.tsx
import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '../../types';
import {
    IoPersonCircleOutline,
    IoSparklesOutline,
    IoGitNetworkOutline,
    IoTrashOutline,
    IoPencilOutline,
    IoCheckmarkOutline,
    IoCloseOutline,
    IoSyncOutline,
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from '../common/CodeBlock';

interface MessageBubbleProps {
    message: Message;
    conversationId: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, conversationId }) => {
    const {
        removeMessageById,
        updateMessageInConversation,
        regenerateResponseForEditedMessage,
        isProcessingEditedMessage,
        activeConversation,
    } = useConversations();

    const isUser = message.sender === 'user';
    const isLoading = message.metadata?.isLoading;
    const isError = Boolean(message.metadata?.error);
    const hasMemorizedItems = (message.metadata?.memorizedItems?.length ?? 0) > 0;

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editedText, setEditedText] = useState<string>(message.text);
    const [showActions, setShowActions] = useState<boolean>(false);

    const editTextareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustEditareaHeight = (): void => {
        if (isEditing && editTextareaRef.current) {
            editTextareaRef.current.style.height = 'auto';
            const maxHeight = 200;
            editTextareaRef.current.style.height = `${Math.min(editTextareaRef.current.scrollHeight, maxHeight)}px`;
            editTextareaRef.current.style.overflowY = editTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    };

    useEffect(adjustEditareaHeight, [isEditing, editedText]);

    useEffect(() => {
        if (isEditing && editTextareaRef.current) {
            const { current } = editTextareaRef;
            current.focus();
            const len = current.value.length;
            current.setSelectionRange(len, len);
        }
    }, [isEditing]);

    const handleDelete = (): void => {
        if (window.confirm('Tem certeza que deseja excluir esta mensagem?')) {
            removeMessageById(conversationId, message.id);
        }
    };

    const handleEdit = (): void => {
        setEditedText(message.text);
        setIsEditing(true);
    };

    const handleSaveEdit = async (): Promise<void> => {
        const newText = editedText.trim();
        setIsEditing(false);

        if (newText === message.text || newText === '') {
            if (newText === '' && message.text !== '' && window.confirm('O texto está vazio. Deseja excluir a mensagem?')) {
                removeMessageById(conversationId, message.id);
            }
            return;
        }

        if (isUser) {
            await regenerateResponseForEditedMessage(conversationId, message.id, newText);
        } else {
            updateMessageInConversation(conversationId, message.id, { text: newText });
        }
    };

    const handleCancelEdit = (): void => {
        setEditedText(message.text);
        setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    const isThisUserMessageBeingReprocessed: boolean =
        isUser &&
        isProcessingEditedMessage &&
        (activeConversation?.messages.some((m) => m.id === message.id && m.text === message.text) ?? false) &&
        Boolean(activeConversation?.messages[activeConversation.messages.length - 1]?.metadata?.isLoading) &&
        ((activeConversation?.messages.findIndex((m) => m.id === message.id) ?? 0) <
            ((activeConversation?.messages.length ?? 1) - 1));

    const canPerformActions =
        !isLoading && !isError && !isProcessingEditedMessage && !isThisUserMessageBeingReprocessed;

    const editTextareaBaseClasses =
        'w-full p-2.5 text-sm text-white focus:outline-none resize-none rounded-lg scrollbar-thin';
    const editTextareaUserClasses = `${editTextareaBaseClasses} bg-blue-700 scrollbar-thumb-blue-500 scrollbar-track-blue-600`;
    const editTextareaAIClasses = `${editTextareaBaseClasses} bg-slate-600 scrollbar-thumb-slate-400 scrollbar-track-slate-500`;

    const editControlsUserClasses = 'text-blue-200 hover:text-white hover:bg-blue-500/50';
    const editControlsAIClasses = 'text-slate-300 hover:text-white hover:bg-slate-500/50';

    const markdownComponents: Components = {
        code: ({ children, ...props }) => (
            <CodeBlock {...props}>{String(children)}</CodeBlock>
        ),
        h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
            <h1 className="text-2xl font-bold my-3" {...props} />
        ),
        h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
            <h2 className="text-xl font-semibold my-2.5" {...props} />
        ),
        h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
            <h3 className="text-lg font-semibold my-2" {...props} />
        ),
        ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
            <ul className="list-disc list-inside my-2 pl-4 space-y-1" {...props} />
        ),
        ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
            <ol className="list-decimal list-inside my-2 pl-4 space-y-1" {...props} />
        ),
        li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="pb-0.5" {...props} />,
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
            <a className="underline" target="_blank" rel="noopener noreferrer" {...props} />
        ),
        blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
            <blockquote className="border-l-4 pl-3 my-2 italic" {...props} />
        ),
        table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
            // Para tabelas, permitir que elas sejam mais largas se necessário
            <div className="overflow-x-auto my-2"><table className="table-auto w-full border border-collapse" {...props} /></div>
        ),
        thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} />,
        th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
            <th className="border px-2 py-1 text-left" {...props} />
        ),
        td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
            <td className="border px-2 py-1" {...props} />
        ),
        strong: (props: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold" {...props} />,
        em: (props: React.HTMLAttributes<HTMLElement>) => <em className="italic" {...props} />,
    };

    return (
        <div
            className="group relative flex flex-col mb-6"
            onMouseEnter={() => canPerformActions && setShowActions(true)}
            onMouseLeave={() => canPerformActions && setShowActions(false)}
        >
            {!isUser && hasMemorizedItems && (
                <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1 ml-10 animate-fadeInQuick">
                    <IoGitNetworkOutline />
                    <span>Memória atualizada</span>
                </div>
            )}

            <div className={`flex items-start gap-2.5 sm:gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md mt-px">
                        <IoSparklesOutline size={18} />
                    </div>
                )}

                <div
                    // Alteração aqui: Removido max-w-[85%]
                    // Aumentados os max-w para breakpoints maiores, mas ainda com um limite.
                    // O `w-full` é importante para que o `message-content` interno possa usar `max-w-none` do prose.
                    className={`relative w-auto sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl 
                        ${isEditing && !isThisUserMessageBeingReprocessed ? 'min-w-[300px] sm:min-w-[400px]' : ''} // Garante largura mínima ao editar
                        ${isUser ? 'order-1' : ''}`}
                >
                    {isEditing && !isThisUserMessageBeingReprocessed ? (
                        <div className={`p-1 rounded-xl shadow-md ${isUser ? 'bg-blue-700' : 'bg-slate-600'}`}>
                            <textarea
                                ref={editTextareaRef}
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                className={isUser ? editTextareaUserClasses : editTextareaAIClasses}
                                rows={1}
                                aria-label="Editar mensagem"
                            />
                            <div className="flex justify-end gap-2 mt-1.5 px-1.5 pb-0.5">
                                <button
                                    onClick={handleCancelEdit}
                                    className={`p-1 rounded ${isUser ? editControlsUserClasses : editControlsAIClasses}`}
                                    title="Cancelar edição (Esc)"
                                >
                                    <IoCloseOutline size={18} />
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className={`p-1 rounded ${isUser ? editControlsUserClasses : editControlsAIClasses}`}
                                    title="Salvar edição (Enter)"
                                    disabled={editedText.trim() === '' && message.text === ''}
                                >
                                    <IoCheckmarkOutline size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            // A classe .prose com max-w-none permite que o conteúdo Markdown defina sua própria largura
                            // até o limite do contêiner pai (definido acima).
                            className={`message-content p-3 sm:p-3.5 rounded-xl sm:rounded-2xl shadow relative 
                                       prose prose-sm prose-invert max-w-none 
                                       whitespace-pre-wrap break-words 
                                ${isUser
                                    ? 'bg-blue-600 text-white prose-strong:text-white prose-a:text-blue-200 hover:prose-a:text-blue-100'
                                    : `bg-slate-700 text-slate-100 prose-a:text-blue-400 hover:prose-a:text-blue-300 ${isError ? '!bg-red-800/90 !border !border-red-600 prose-p:text-red-100' : ''
                                    }`
                                } ${(isLoading || isThisUserMessageBeingReprocessed) ? 'opacity-70 animate-pulseSlow' : ''}`}
                        >
                            {isThisUserMessageBeingReprocessed && (
                                <div className="absolute -top-1.5 -right-1.5 p-0.5 bg-slate-600 rounded-full shadow z-10">
                                    <IoSyncOutline size={12} className="text-slate-300 animate-spin" />
                                </div>
                            )}

                            {isLoading && !message.text && <span className="inline-block animate-pulseSlow text-transparent">▍</span>}

                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {message.text || (isLoading ? '' : '...')}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {isUser && (
                    <div
                        className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 shadow-md mt-px ${isEditing ? 'self-start' : ''
                            }`}
                    >
                        <IoPersonCircleOutline size={20} />
                    </div>
                )}

                {canPerformActions && showActions && !isEditing && (
                    <div
                        className={`flex items-center rounded-full shadow-lg bg-slate-750 border border-slate-600/50 p-0.5 
                                    absolute top-[-10px] transform -translate-y-1/2 transition-all duration-200 ease-out z-20  bg-gray-900/80
                                    ${isUser ? 'right-0' : 'left-11'}
                                    ${showActions ? 'opacity-80 scale-100' : 'opacity-20 scale-90 pointer-events-none'}`}
                    >
                        <button
                            onClick={handleEdit}
                            className="p-1.5 text-slate-300 hover:text-blue-400 hover:bg-slate-600/70 rounded-full"
                            title="Editar mensagem"
                            disabled={isProcessingEditedMessage}
                        >
                            <IoPencilOutline size={14} />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-600/70 rounded-full"
                            title="Excluir mensagem"
                            disabled={isProcessingEditedMessage}
                        >
                            <IoTrashOutline size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageBubble;