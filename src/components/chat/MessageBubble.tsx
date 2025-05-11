// src/components/chat/MessageBubble.tsx
import React, { useState, useRef, useEffect } from 'react';
import type { Message, MessageMetadata, MemoryActionType } from '../../types/conversation'; // Ajuste o caminho se necessário
import {
    IoPersonCircleOutline, IoSparklesOutline, IoGitNetworkOutline, IoTrashOutline,
    IoPencilOutline, IoCheckmarkOutline, IoCloseOutline, IoSyncOutline,
    IoCreateOutline, IoInformationCircleOutline, IoRemoveCircleOutline,
    IoDocumentTextOutline, IoImageOutline,
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import { useMemories } from '../../contexts/MemoryContext';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from '../common/CodeBlock';

interface MessageBubbleProps {
    message: Message;
    conversationId: string;
}

// ... (MemoryActionItem COMPLETO como fornecido anteriormente)
interface MemoryActionItemProps {
    memoryActionDetail: NonNullable<MessageMetadata['memorizedMemoryActions']>[0];
}

const MemoryActionItem: React.FC<MemoryActionItemProps> = ({ memoryActionDetail }) => {
    const { memories, updateMemory, deleteMemory } = useMemories();
    const [isEditingMemory, setIsEditingMemory] = useState(false);
    const currentMemoryInContext = memories.find(m => m.id === memoryActionDetail.id);
    const [editedMemoryContent, setEditedMemoryContent] = useState(
        currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content
    );

    useEffect(() => {
        if (currentMemoryInContext && !isEditingMemory) {
            setEditedMemoryContent(currentMemoryInContext.content);
        } else if (!currentMemoryInContext && !isEditingMemory && memoryActionDetail.action !== 'deleted_by_ai') {
            setEditedMemoryContent(memoryActionDetail.content);
        }
    }, [currentMemoryInContext, isEditingMemory, memoryActionDetail.content, memoryActionDetail.action]);

    const displayContent = currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content;
    const memoryExistsInContext = !!currentMemoryInContext;

    const handleEditMemory = () => {
        if (!currentMemoryInContext) return;
        setEditedMemoryContent(currentMemoryInContext.content);
        setIsEditingMemory(true);
    };

    const handleSaveMemoryEdit = () => {
        if (!currentMemoryInContext) return;
        const trimmedContent = editedMemoryContent.trim();
        if (trimmedContent && trimmedContent !== currentMemoryInContext.content) {
            updateMemory(memoryActionDetail.id, trimmedContent);
        } else if (!trimmedContent && currentMemoryInContext.content) {
            if (window.confirm(`O conteúdo da memória "${currentMemoryInContext.content}" está vazio. Deseja excluir esta memória?`)) {
                deleteMemory(memoryActionDetail.id);
            }
        }
        setIsEditingMemory(false);
    };

    const handleCancelMemoryEdit = () => {
        setEditedMemoryContent(currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content);
        setIsEditingMemory(false);
    };

    const handleDeleteUserMemory = () => {
        if (!currentMemoryInContext) return;
        if (window.confirm(`Tem certeza que deseja excluir a memória: "${currentMemoryInContext.content}"? Esta ação afeta o armazenamento global de memórias.`)) {
            deleteMemory(memoryActionDetail.id);
        }
    };

    let ActionIconComponent = IoGitNetworkOutline;
    let itemTitle = `Memória: "${memoryActionDetail.content}"`;
    let displayText = `"${memoryActionDetail.content}"`;

    if (memoryActionDetail.action === 'created') {
        ActionIconComponent = IoGitNetworkOutline;
        if (!memoryExistsInContext && !isEditingMemory) {
            displayText = `"${memoryActionDetail.content}" (removida pelo usuário)`;
        } else {
            displayText = `"${displayContent}"`;
        }
    } else if (memoryActionDetail.action === 'updated') {
        ActionIconComponent = IoInformationCircleOutline;
        itemTitle = `Memória atualizada de "${memoryActionDetail.originalContent}" para "${memoryActionDetail.content}"`;
        if (!memoryExistsInContext && !isEditingMemory) {
            displayText = `De: "${memoryActionDetail.originalContent}" Para: "${memoryActionDetail.content}" (agora removida pelo usuário)`;
        } else {
            displayText = `De: "${memoryActionDetail.originalContent}" Para: "${displayContent}"`;
        }
    } else if (memoryActionDetail.action === 'deleted_by_ai') {
        ActionIconComponent = IoRemoveCircleOutline;
        itemTitle = `Memória removida pela IA: "${memoryActionDetail.originalContent}"`;
        displayText = `"${memoryActionDetail.originalContent}" (removida pela IA)`;
    }

    if (!memoryExistsInContext && memoryActionDetail.action !== 'deleted_by_ai' && !isEditingMemory) {
        return (
            <li className="flex items-center justify-between text-slate-500 italic py-1 px-1 -mx-1 min-h-[28px] max-w-full overflow-hidden">
                <span className="line-through truncate flex items-center" title={`Memória original: "${memoryActionDetail.originalContent || memoryActionDetail.content}"`}>
                    <ActionIconComponent className="mr-1 flex-shrink-0" />
                    <span className="whitespace-pre-wrap break-words">{memoryActionDetail.originalContent || memoryActionDetail.content}</span> (removida pelo usuário)
                </span>
            </li>
        );
    }

    return (
        <li className="group/memory-item flex items-center justify-between py-1 hover:bg-slate-700/50 rounded px-1 -mx-1 min-h-[28px]">
            {isEditingMemory && currentMemoryInContext ? (
                <div className="flex-grow flex items-center gap-1 w-full">
                    <input
                        type="text"
                        value={editedMemoryContent}
                        onChange={(e) => setEditedMemoryContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveMemoryEdit(); }
                            if (e.key === 'Escape') { e.preventDefault(); handleCancelMemoryEdit(); }
                        }}
                        className="flex-grow text-xs bg-slate-800 text-slate-200 p-1 rounded border border-slate-600 focus:outline-none focus:border-purple-500"
                        autoFocus
                    />
                    <button onClick={handleSaveMemoryEdit} className="p-1 text-green-400 hover:text-green-300 flex-shrink-0" title="Salvar (Enter)">
                        <IoCheckmarkOutline size={14} />
                    </button>
                    <button onClick={handleCancelMemoryEdit} className="p-1 text-slate-400 hover:text-slate-300 flex-shrink-0" title="Cancelar (Esc)">
                        <IoCloseOutline size={14} />
                    </button>
                </div>
            ) : (
                <>
                    <span
                        className={`truncate text-sm flex items-center ${memoryExistsInContext || memoryActionDetail.action === 'deleted_by_ai'
                                ? 'text-slate-300'
                                : 'text-slate-500 line-through'
                            }`}
                        title={itemTitle}
                    >
                        <ActionIconComponent className="mr-1.5 flex-shrink-0" />
                        <span className="whitespace-pre-wrap break-all">{displayText}</span>
                    </span>
                    {memoryExistsInContext && memoryActionDetail.action !== 'deleted_by_ai' && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/memory-item:opacity-100 transition-opacity flex-shrink-0">
                            <button
                                onClick={handleEditMemory}
                                className="p-1 text-purple-400 hover:text-purple-300"
                                title="Editar esta memória no sistema"
                            >
                                <IoCreateOutline size={13} />
                            </button>
                            <button
                                onClick={handleDeleteUserMemory}
                                className="p-1 text-red-400 hover:text-red-300"
                                title="Excluir esta memória do sistema"
                            >
                                <IoTrashOutline size={13} />
                            </button>
                        </div>
                    )}
                </>
            )}
        </li>
    );
};


const MAX_THUMBNAIL_SIZE_IN_BUBBLE = 100;

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
    const isErrorString = typeof message.metadata?.error === 'string' && message.metadata.error.length > 0;
    const isErrorFlag = Boolean(message.metadata?.error);

    const memoryActions = message.metadata?.memorizedMemoryActions;
    const hasMemoryActions = memoryActions && memoryActions.length > 0;

    const attachedFilesInfo = message.metadata?.attachedFilesInfo;
    const hasAttachedFiles = !!(attachedFilesInfo && attachedFilesInfo.length > 0);

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

        if (newText === message.text) return;

        if (newText === '' && !hasAttachedFiles) {
            if (message.text !== '' && window.confirm('O texto está vazio e não há anexos. Deseja excluir a mensagem?')) {
                removeMessageById(conversationId, message.id);
            }
            return;
        }

        if (isUser) {
            await regenerateResponseForEditedMessage(conversationId, message.id, newText);
        } else {
            updateMessageInConversation(conversationId, message.id, {
                text: newText,
                metadata: { ...message.metadata }
            });
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

    const canPerformActionsOnMessage =
        !isLoading && !isErrorFlag && !isProcessingEditedMessage && !isThisUserMessageBeingReprocessed;

    const editTextareaBaseClasses = 'w-full p-2.5 text-sm text-white focus:outline-none resize-none rounded-lg scrollbar-thin';
    const editTextareaUserClasses = `${editTextareaBaseClasses} bg-blue-700 scrollbar-thumb-blue-500 scrollbar-track-blue-600`;
    const editTextareaAIClasses = `${editTextareaBaseClasses} bg-slate-600 scrollbar-thumb-slate-400 scrollbar-track-slate-500`;
    const editControlsUserClasses = 'text-blue-200 hover:text-white hover:bg-blue-500/50';
    const editControlsAIClasses = 'text-slate-300 hover:text-white hover:bg-slate-500/50';

    const markdownComponents: Components = {
        code: ({ children, ...props }) => (<CodeBlock {...props}>{String(children)}</CodeBlock>),
        h1: (props) => (<h1 className="text-2xl font-bold my-3" {...props} />),
        h2: (props) => (<h2 className="text-xl font-semibold my-2.5" {...props} />),
        h3: (props) => (<h3 className="text-lg font-semibold my-2" {...props} />),
        ul: (props) => (<ul className="list-disc list-inside my-2 pl-4 space-y-1" {...props} />),
        ol: (props) => (<ol className="list-decimal list-inside my-2 pl-4 space-y-1" {...props} />),
        li: (props) => <li className="pb-0.5" {...props} />,
        a: (props) => (<a className="underline" target="_blank" rel="noopener noreferrer" {...props} />),
        blockquote: (props) => (<blockquote className="border-l-4 pl-3 my-2 italic" {...props} />),
        table: (props) => (<div className="overflow-x-auto my-2"><table className="table-auto w-full border border-collapse" {...props} /></div>),
        thead: (props) => <thead {...props} />,
        th: (props) => (<th className="border px-2 py-1 text-left" {...props} />),
        td: (props) => (<td className="border px-2 py-1" {...props} />),
        strong: (props) => <strong className="font-semibold" {...props} />,
        em: (props) => <em className="italic" {...props} />,
    };

    let mainMemoryActionLabel = "Operações de memória:";
    let MainActionIcon = IoGitNetworkOutline;
    if (hasMemoryActions && memoryActions) {
        const actionsSet = new Set(memoryActions.map(a => a.action));
        if (actionsSet.size === 1) {
            const singleAction = actionsSet.values().next().value as MemoryActionType;
            if (singleAction === 'created') {
                mainMemoryActionLabel = memoryActions.length > 1 ? "Novas memórias:" : "Nova memória:";
                MainActionIcon = IoGitNetworkOutline;
            } else if (singleAction === 'updated') {
                mainMemoryActionLabel = memoryActions.length > 1 ? "Memórias atualizadas:" : "Memória atualizada:";
                MainActionIcon = IoInformationCircleOutline;
            } else if (singleAction === 'deleted_by_ai') {
                mainMemoryActionLabel = memoryActions.length > 1 ? "Memórias removidas (IA):" : "Memória removida (IA):";
                MainActionIcon = IoRemoveCircleOutline;
            }
        } else if (actionsSet.size > 1) {
            mainMemoryActionLabel = "Múltiplas ações de memória:";
            const firstAction = memoryActions[0].action;
            if (firstAction === 'created') MainActionIcon = IoGitNetworkOutline;
            else if (firstAction === 'updated') MainActionIcon = IoInformationCircleOutline;
            else if (firstAction === 'deleted_by_ai') MainActionIcon = IoRemoveCircleOutline;
        }
    }

    const messageContainerBaseClass = `p-3 sm:p-3.5 rounded-xl sm:rounded-2xl shadow relative prose prose-sm prose-invert max-w-none`;
    const messageUserClass = `${messageContainerBaseClass} bg-blue-600 text-white prose-strong:text-white prose-a:text-blue-200 hover:prose-a:text-blue-100`;
    const messageAIClass = `${messageContainerBaseClass} bg-slate-700 text-slate-100 prose-a:text-blue-400 hover:prose-a:text-blue-300 ${isErrorFlag ? '!bg-red-800/90 !border !border-red-600 prose-p:text-red-100' : ''}`;
    const messageLoadingClass = `opacity-70 animate-pulse bg-slate-600/50 border border-slate-500/50`;

    // Condição para determinar se o balão de texto principal deve ser renderizado
    const shouldRenderTextBubbleContent =
        message.text.trim().length > 0 ||
        (!isUser && isErrorString); // Mostra balão para texto ou erro da IA

    // Condição para mostrar animação de "digitando" da IA
    const showAITypingIndicator = !isUser && isLoading && message.text.trim() === '';

    return (
        <div
            className="group relative flex flex-col mb-6"
            onMouseEnter={() => canPerformActionsOnMessage && setShowActions(true)}
            onMouseLeave={() => canPerformActionsOnMessage && setShowActions(false)}
        >
            {/* Container para as miniaturas ANEXADAS, posicionado ACIMA do balão de texto */}
            {isUser && hasAttachedFiles && attachedFilesInfo && (
                <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex flex-wrap gap-2 ${isUser ? 'pl-10 sm:pl-11' : 'pr-10 sm:pr-11'}`}>
                        {attachedFilesInfo.map(fileInfo => (
                            <div key={fileInfo.id} className="bg-slate-800/50 border border-slate-700 p-1 rounded-lg shadow-sm overflow-hidden">
                                {fileInfo.dataUrl && fileInfo.type.startsWith('image/') ? (
                                    <img
                                        src={fileInfo.dataUrl}
                                        alt={`Preview ${fileInfo.name}`}
                                        className="object-cover rounded"
                                        style={{
                                            maxWidth: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE}px`,
                                            maxHeight: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE}px`,
                                            display: 'block'
                                        }}
                                        title={`${fileInfo.name} (${(fileInfo.size / 1024).toFixed(1)} KB)`}
                                    />
                                ) : (
                                    <div
                                        className="flex flex-col items-center justify-center text-xs p-2 text-center bg-slate-700/70 rounded"
                                        style={{
                                            width: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE * 0.9}px`,
                                            height: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE * 0.9}px`,
                                            minWidth: '60px',
                                        }}
                                        title={`${fileInfo.name} (${(fileInfo.size / 1024).toFixed(1)} KB)`}
                                    >
                                        {fileInfo.type.startsWith('image/') ? <IoImageOutline size={24} className="mb-1 text-slate-400" /> : <IoDocumentTextOutline size={24} className="mb-1 text-slate-400" />}
                                        <span className="truncate block w-full text-slate-300">{fileInfo.name}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Balão de mensagem principal (texto e avatar) */}
            {/* Renderiza se houver conteúdo de texto, ou se for IA carregando/com erro */}
            {(shouldRenderTextBubbleContent || showAITypingIndicator) && (
                <div className={`flex items-start gap-2.5 sm:gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md mt-px">
                            <IoSparklesOutline size={18} />
                        </div>
                    )}
                    <div
                        className={`relative w-auto sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl 
                            ${isEditing && !isThisUserMessageBeingReprocessed ? 'min-w-[300px] sm:min-w-[400px]' : ''}
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
                                    <button onClick={handleCancelEdit} className={`p-1 rounded ${isUser ? editControlsUserClasses : editControlsAIClasses}`} title="Cancelar edição (Esc)"> <IoCloseOutline size={18} /> </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        className={`p-1 rounded ${isUser ? editControlsUserClasses : editControlsAIClasses}`}
                                        title="Salvar edição (Enter)"
                                        disabled={isProcessingEditedMessage || (editedText.trim() === '' && !hasAttachedFiles && message.text === '')}
                                    >
                                        <IoCheckmarkOutline size={18} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`${isUser ? messageUserClass : messageAIClass} ${isLoading && !showAITypingIndicator ? messageLoadingClass : ''}`}>
                                {isThisUserMessageBeingReprocessed && (<div className="absolute -top-1.5 -right-1.5 p-0.5 bg-slate-600 rounded-full shadow z-10"> <IoSyncOutline size={12} className="text-slate-300 animate-spin" /> </div>)}

                                {/* Conteúdo do Balão */}
                                {showAITypingIndicator ? (
                                    <div className="typing-dots flex items-center space-x-1 h-5"> {/* Ajuste a altura (h-5) conforme necessário */}
                                        <span className="block w-2 h-2 bg-current rounded-full"></span>
                                        <span className="block w-2 h-2 bg-current rounded-full"></span>
                                        <span className="block w-2 h-2 bg-current rounded-full"></span>
                                    </div>
                                ) : (
                                    <>
                                        {(message.text.trim().length > 0) && (
                                            <div className="message-text-content whitespace-pre-wrap break-words">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                                    {message.text}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {isErrorString && (
                                            <div className={`mt-2 text-xs text-red-300 ${message.text.trim().length > 0 ? 'border-t border-red-500/50 pt-1.5' : ''}`}>
                                                Erro: {message.metadata?.error}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {isUser && (<div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 shadow-md mt-px ${isEditing ? 'self-start' : ''}`} > <IoPersonCircleOutline size={20} /> </div>)}

                    {canPerformActionsOnMessage && showActions && !isEditing && (
                        <div className={`flex items-center rounded-full shadow-lg bg-slate-750 border border-slate-600/50 p-0.5 absolute transform -translate-y-1/2 transition-all duration-200 ease-out z-20 bg-gray-900/80 
                         ${isUser ? 'right-0' : 'left-11'} 
                         ${(hasAttachedFiles && isUser && (shouldRenderTextBubbleContent || showAITypingIndicator)) ? 'top-[calc(-10px - 0.5rem)]' : 'top-[-10px]'}
                         ${showActions ? 'opacity-80 scale-100' : 'opacity-20 scale-90 pointer-events-none'}`}>
                            <button onClick={handleEdit} className="p-1.5 text-slate-300 hover:text-blue-400 hover:bg-slate-600/70 rounded-full" title="Editar mensagem" disabled={isProcessingEditedMessage} > <IoPencilOutline size={14} /> </button>
                            <button onClick={handleDelete} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-600/70 rounded-full" title="Excluir mensagem" disabled={isProcessingEditedMessage} > <IoTrashOutline size={14} /> </button>
                        </div>
                    )}
                </div>
            )}

            {/* Renderização de MemoryActions */}
            {!isUser && hasMemoryActions && memoryActions && (
                <div className="mt-2.5 ml-10 mr-2 sm:mr-0 animate-fadeInQuick">
                    <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1.5">
                        <MainActionIcon />
                        <span>{mainMemoryActionLabel}</span>
                    </div>
                    <ul className="text-xs space-y-0.5 pl-2 border-l-2 border-slate-600/70">
                        {memoryActions.map((actionDetail, index) => (
                            <MemoryActionItem
                                key={`${actionDetail.id}-${index}-${actionDetail.action}`}
                                memoryActionDetail={actionDetail}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MessageBubble;