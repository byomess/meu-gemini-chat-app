// src/components/chat/MessageBubble.tsx
import React, { useState, useRef, useEffect } from 'react';
// Importe os tipos atualizados, incluindo MemoryActionType
import type { Message, MessageMetadata, MemoryActionType } from '../../types';
import {
    IoPersonCircleOutline,
    IoSparklesOutline,
    IoGitNetworkOutline, // Usado como ícone padrão para 'created'
    IoTrashOutline,
    IoPencilOutline,
    IoCheckmarkOutline,
    IoCloseOutline,
    IoSyncOutline,
    IoCreateOutline,       // Ícone para o botão de editar memória pelo usuário
    IoInformationCircleOutline, // Ícone para memória 'updated'
    IoRemoveCircleOutline,    // Ícone para memória 'deleted_by_ai'
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

// Subcomponente para cada item de ação de memória
interface MemoryActionItemProps {
    // Recebe o objeto completo da ação de memória dos metadados da mensagem
    memoryActionDetail: NonNullable<MessageMetadata['memorizedMemoryActions']>[0];
}

const MemoryActionItem: React.FC<MemoryActionItemProps> = ({ memoryActionDetail }) => {
    const { memories, updateMemory, deleteMemory } = useMemories();
    const [isEditingMemory, setIsEditingMemory] = useState(false);

    // Encontra a memória ATUAL no contexto pelo ID para refletir seu estado real
    const currentMemoryInContext = memories.find(m => m.id === memoryActionDetail.id);
    
    // O conteúdo a ser editado é o conteúdo atual da memória se ela existir,
    // caso contrário (ex: memória foi deletada e esta é uma entrada 'deleted_by_ai' ou 'updated' para uma memória já deletada),
    // usamos o content do memoryActionDetail como fallback.
    const [editedMemoryContent, setEditedMemoryContent] = useState(
        currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content
    );

    useEffect(() => {
        // Sincroniza o campo de edição se a memória no contexto mudar e não estivermos editando
        if (currentMemoryInContext && !isEditingMemory) {
            setEditedMemoryContent(currentMemoryInContext.content);
        } else if (!currentMemoryInContext && !isEditingMemory && memoryActionDetail.action !== 'deleted_by_ai') {
            // Se a memória foi excluída externamente (não é uma ação 'deleted_by_ai' desta mensagem)
            // e não estamos editando, reseta para o conteúdo original da ação.
            setEditedMemoryContent(memoryActionDetail.content);
        }
    }, [currentMemoryInContext, isEditingMemory, memoryActionDetail.content, memoryActionDetail.action]);
    
    // O conteúdo a ser exibido depende se a memória ainda existe no contexto
    const displayContent = currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content;
    const memoryExistsInContext = !!currentMemoryInContext;

    const handleEditMemory = () => {
        if (!currentMemoryInContext) return; // Só edita se a memória existir no contexto
        setEditedMemoryContent(currentMemoryInContext.content);
        setIsEditingMemory(true);
    };

    const handleSaveMemoryEdit = () => {
        if (!currentMemoryInContext) return; // Segurança: só salva se a memória ainda existir
        const trimmedContent = editedMemoryContent.trim();
        if (trimmedContent && trimmedContent !== currentMemoryInContext.content) {
            updateMemory(memoryActionDetail.id, trimmedContent);
        } else if (!trimmedContent && currentMemoryInContext.content) { // Se o conteúdo ficou vazio
            if (window.confirm(`O conteúdo da memória "${currentMemoryInContext.content}" está vazio. Deseja excluir esta memória?`)) {
                deleteMemory(memoryActionDetail.id);
            }
        }
        setIsEditingMemory(false);
    };

    const handleCancelMemoryEdit = () => {
        // Reseta para o conteúdo da memória no contexto, ou para o conteúdo da ação se a memória não existir mais
        setEditedMemoryContent(currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content);
        setIsEditingMemory(false);
    };

    const handleDeleteUserMemory = () => {
        if (window.confirm(`Tem certeza que deseja excluir a memória: "${displayContent}"? Esta ação afeta o armazenamento global de memórias.`)) {
            deleteMemory(memoryActionDetail.id);
        }
    };

    // Determinar ícone e texto com base na ação da memória
    let ActionIconComponent = IoGitNetworkOutline; // Padrão para 'created'
    let itemTitle = `Memória: "${memoryActionDetail.content}"`;
    let displayText = `"${memoryActionDetail.content}"`;

    if (memoryActionDetail.action === 'created') {
        ActionIconComponent = IoGitNetworkOutline;
        // displayText já é o conteúdo da memória criada
    } else if (memoryActionDetail.action === 'updated') {
        ActionIconComponent = IoInformationCircleOutline;
        itemTitle = `Memória atualizada de "${memoryActionDetail.originalContent}" para "${memoryActionDetail.content}"`;
        displayText = `De: "${memoryActionDetail.originalContent}" Para: "${displayContent}"`;
        // Se a memória foi atualizada mas agora não existe mais no contexto (ex: deletada pelo usuário depois), indicamos.
        if (!memoryExistsInContext) {
            displayText += " (agora removida)";
        }
    } else if (memoryActionDetail.action === 'deleted_by_ai') {
        ActionIconComponent = IoRemoveCircleOutline;
        itemTitle = `Memória removida pela IA: "${memoryActionDetail.originalContent}"`;
        displayText = `"${memoryActionDetail.originalContent}" (removida pela IA)`;
    }

    // Se a memória foi associada a uma ação ('created' ou 'updated') mas não existe mais no contexto E não foi uma deleção pela IA
    if (!memoryExistsInContext && memoryActionDetail.action !== 'deleted_by_ai' && !isEditingMemory) {
        return (
            <li className="flex items-center justify-between text-slate-500 italic py-1 px-1 -mx-1 min-h-[28px]">
                <span className="line-through truncate flex items-center" title={`Memória original: "${memoryActionDetail.content}"`}>
                    <ActionIconComponent className="mr-1 flex-shrink-0" /> 
                    "{memoryActionDetail.content}" (removida pelo usuário)
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
                        className={`truncate text-sm flex items-center ${
                            memoryExistsInContext || memoryActionDetail.action === 'deleted_by_ai' 
                                ? 'text-slate-300' 
                                : 'text-slate-500 line-through'
                        }`}
                        title={itemTitle}
                    >
                        <ActionIconComponent className="mr-1.5 flex-shrink-0" />
                        <span className="whitespace-pre-wrap break-all">{displayText}</span>
                    </span>
                    {/* Botões de ação do usuário (editar/deletar) só aparecem se a memória ainda existe no contexto */}
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
    
    const memoryActions = message.metadata?.memorizedMemoryActions;
    const hasMemoryActions = memoryActions && memoryActions.length > 0;

    // Se você ainda tem a lógica antiga de `memorizedItems` para compatibilidade, pode mantê-la.
    // const hasLegacyMemorizedItems = (message.metadata?.memorizedItems?.length ?? 0) > 0;

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
        !isLoading && !isError && !isProcessingEditedMessage && !isThisUserMessageBeingReprocessed;

    const editTextareaBaseClasses =
        'w-full p-2.5 text-sm text-white focus:outline-none resize-none rounded-lg scrollbar-thin';
    const editTextareaUserClasses = `${editTextareaBaseClasses} bg-blue-700 scrollbar-thumb-blue-500 scrollbar-track-blue-600`;
    const editTextareaAIClasses = `${editTextareaBaseClasses} bg-slate-600 scrollbar-thumb-slate-400 scrollbar-track-slate-500`;

    const editControlsUserClasses = 'text-blue-200 hover:text-white hover:bg-blue-500/50';
    const editControlsAIClasses = 'text-slate-300 hover:text-white hover:bg-slate-500/50';

    const markdownComponents: Components = {
        code: ({ children, ...props }) => ( <CodeBlock {...props}>{String(children)}</CodeBlock> ),
        h1: (props) => ( <h1 className="text-2xl font-bold my-3" {...props} /> ),
        h2: (props) => ( <h2 className="text-xl font-semibold my-2.5" {...props} /> ),
        h3: (props) => ( <h3 className="text-lg font-semibold my-2" {...props} /> ),
        ul: (props) => ( <ul className="list-disc list-inside my-2 pl-4 space-y-1" {...props} /> ),
        ol: (props) => ( <ol className="list-decimal list-inside my-2 pl-4 space-y-1" {...props} /> ),
        li: (props) => <li className="pb-0.5" {...props} />,
        a: (props) => ( <a className="underline" target="_blank" rel="noopener noreferrer" {...props} /> ),
        blockquote: (props) => ( <blockquote className="border-l-4 pl-3 my-2 italic" {...props} /> ),
        table: (props) => ( <div className="overflow-x-auto my-2"><table className="table-auto w-full border border-collapse" {...props} /></div> ),
        thead: (props) => <thead {...props} />,
        th: (props) => ( <th className="border px-2 py-1 text-left" {...props} /> ),
        td: (props) => ( <td className="border px-2 py-1" {...props} /> ),
        strong: (props) => <strong className="font-semibold" {...props} />,
        em: (props) => <em className="italic" {...props} />,
    };

    // Determinar o label principal para o grupo de ações de memória
    let mainMemoryActionLabel = "Operações de memória:";
    let MainActionIcon = IoGitNetworkOutline; // Ícone padrão para o título
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
            // Poderia escolher um ícone mais genérico ou o do primeiro item
            const firstAction = memoryActions[0].action;
            if (firstAction === 'created') MainActionIcon = IoGitNetworkOutline;
            else if (firstAction === 'updated') MainActionIcon = IoInformationCircleOutline;
            else if (firstAction === 'deleted_by_ai') MainActionIcon = IoRemoveCircleOutline;
        }
    }


    return (
        <div
            className="group relative flex flex-col mb-6"
            onMouseEnter={() => canPerformActionsOnMessage && setShowActions(true)}
            onMouseLeave={() => canPerformActionsOnMessage && setShowActions(false)}
        >
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
                                <button onClick={handleSaveEdit} className={`p-1 rounded ${isUser ? editControlsUserClasses : editControlsAIClasses}`} title="Salvar edição (Enter)" disabled={editedText.trim() === '' && message.text === '' && !isUser} > <IoCheckmarkOutline size={18} /> </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`message-content p-3 sm:p-3.5 rounded-xl sm:rounded-2xl shadow relative prose prose-sm prose-invert max-w-none whitespace-pre-wrap break-words 
                                ${isUser ? 'bg-blue-600 text-white prose-strong:text-white prose-a:text-blue-200 hover:prose-a:text-blue-100'
                                    : `bg-slate-700 text-slate-100 prose-a:text-blue-400 hover:prose-a:text-blue-300 ${isError ? '!bg-red-800/90 !border !border-red-600 prose-p:text-red-100' : '' }`
                                } ${(isLoading || isThisUserMessageBeingReprocessed) ? 'opacity-70 animate-pulseSlow' : ''}`}
                        >
                            {isThisUserMessageBeingReprocessed && ( <div className="absolute -top-1.5 -right-1.5 p-0.5 bg-slate-600 rounded-full shadow z-10"> <IoSyncOutline size={12} className="text-slate-300 animate-spin" /> </div> )}
                            {isLoading && !message.text && <span className="inline-block animate-pulseSlow text-transparent">▍</span>}
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {message.text || (isLoading ? '' : '...')}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
                {isUser && ( <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 shadow-md mt-px ${isEditing ? 'self-start' : '' }`} > <IoPersonCircleOutline size={20} /> </div> )}
                {canPerformActionsOnMessage && showActions && !isEditing && (
                    <div className={`flex items-center rounded-full shadow-lg bg-slate-750 border border-slate-600/50 p-0.5 absolute top-[-10px] transform -translate-y-1/2 transition-all duration-200 ease-out z-20 bg-gray-900/80 ${isUser ? 'right-0' : 'left-11'} ${showActions ? 'opacity-80 scale-100' : 'opacity-20 scale-90 pointer-events-none'}`}>
                        <button onClick={handleEdit} className="p-1.5 text-slate-300 hover:text-blue-400 hover:bg-slate-600/70 rounded-full" title="Editar mensagem" disabled={isProcessingEditedMessage} > <IoPencilOutline size={14} /> </button>
                        <button onClick={handleDelete} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-600/70 rounded-full" title="Excluir mensagem" disabled={isProcessingEditedMessage} > <IoTrashOutline size={14} /> </button>
                    </div>
                )}
            </div>

            {!isUser && hasMemoryActions && memoryActions && (
                <div className="mt-2.5 ml-10 mr-2 sm:mr-0 animate-fadeInQuick">
                    <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1.5">
                        <MainActionIcon />
                        <span>{mainMemoryActionLabel}</span>
                    </div>
                    <ul className="text-xs space-y-0.5 pl-2 border-l-2 border-slate-600/70">
                        {memoryActions.map((actionDetail, index) => (
                            <MemoryActionItem
                                key={`${actionDetail.id}-${index}`} 
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