/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/chat/MessageBubble.tsx
import React, { useState, useRef, useEffect } from 'react';
import type { Message, MessageMetadata, MemoryActionType, AttachedFileInfo, Part, ProcessingStatus } from '../../types'; // Adicionado ProcessingStatus explicitamente
import {
    IoPersonCircleOutline, IoSparklesOutline, IoGitNetworkOutline, IoTrashOutline,
    IoPencilOutline, IoCheckmarkOutline, IoCloseOutline, IoSyncOutline,
    IoCreateOutline, IoInformationCircleOutline, IoRemoveCircleOutline,
    IoDocumentTextOutline, IoImageOutline, IoMusicalNotesOutline, IoVideocamOutline, IoTerminalOutline,
    IoGitCommitOutline,
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext'; // Importar useAppSettings
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import CodeBlock from '../common/CodeBlock';
import CustomAudioPlayer from '../common/CustomAudioPlayer';
import Button from '../common/Button';
import useIsMobile from '../../hooks/useIsMobile';
import type { FunctionCall, FunctionResponse } from '@google/genai';

import FunctionCallActivityIndicator from './FunctionCallActivityIndicator';
import FileProcessingActivityIndicator from './FileProcessingActivityIndicator';
import { MemoryActionItem } from './MemoryActionItem';
import { MediaModal } from '../common/MediaModal';

const MAX_THUMBNAIL_SIZE_IN_BUBBLE = 100;
const MIN_INDICATOR_TYPE_DISPLAY_TIME = 1000;

interface MessageBubbleProps {
    message: Message;
    conversationId: string;
}

// Interface CustomCodeRendererProps (sem alteração)
interface CustomCodeRendererProps extends React.HTMLAttributes<HTMLElement>, ExtraProps {
    inline?: boolean;
    children?: React.ReactNode;
    className?: string;
    node?: any;
}


const MessageBubble: React.FC<MessageBubbleProps> = ({ message, conversationId }) => {
    const {
        removeMessageById,
        updateMessageInConversation,
        regenerateResponseForEditedMessage,
        isProcessingEditedMessage,
        activeConversation,
        isGeneratingResponse,
    } = useConversations();
    const { settings } = useAppSettings(); // Obter configurações globais

    const isMobile = useIsMobile();

    const isUser = message.sender === 'user';
    const isFunctionRole = message.sender === 'function';
    const isLoading = message.metadata?.isLoading;
    const incomingProcessingStatus = message.metadata?.processingStatus; // Status vindo das props

    // Estado para o status que está efetivamente sendo usado para renderizar o indicador
    const [activeDisplayStatus, setActiveDisplayStatus] = useState<ProcessingStatus | undefined>(incomingProcessingStatus);
    const indicatorTypeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastIndicatorTypeSetTimeRef = useRef<number>(0);
    // Ref para guardar o tipo do último indicador que começou a ser exibido
    const currentIndicatorTypeRef = useRef<ProcessingStatus['type'] | undefined>(undefined);

    const [aiAvatarLoadError, setAiAvatarLoadError] = useState(false); // Estado para erro de carregamento do avatar da IA

    useEffect(() => {
        // Resetar erro de avatar quando a URL do avatar ou a mensagem mudar
        setAiAvatarLoadError(false);
    }, [settings.aiAvatarUrl, message.id]);


    useEffect(() => {
        // Inicializa activeDisplayStatus e o tempo quando o componente monta ou incomingProcessingStatus aparece pela primeira vez
        if (incomingProcessingStatus && !activeDisplayStatus) {
            setActiveDisplayStatus(incomingProcessingStatus);
            lastIndicatorTypeSetTimeRef.current = Date.now();
            currentIndicatorTypeRef.current = incomingProcessingStatus.type;
        }
    }, [incomingProcessingStatus, activeDisplayStatus]);


    useEffect(() => {
        // Se não há status vindo das props, e tínhamos um status ativo, limpamos.
        if (!incomingProcessingStatus && activeDisplayStatus) {
            if (indicatorTypeChangeTimeoutRef.current) {
                clearTimeout(indicatorTypeChangeTimeoutRef.current);
            }
            // Poderia haver um delay para limpar também, se desejado, mas por ora limpa direto
            setActiveDisplayStatus(undefined);
            currentIndicatorTypeRef.current = undefined;
            lastIndicatorTypeSetTimeRef.current = 0;
            return;
        }

        // Se não há status vindo, não faz nada.
        if (!incomingProcessingStatus) {
            return;
        }

        // Se o incomingProcessingStatus é "igual" (mesmo tipo e stage relevante) ao activeDisplayStatus,
        // apenas atualiza o activeDisplayStatus para garantir que 'details' etc. estejam atualizados.
        // Os filhos cuidarão do seu próprio timing interno para stages.
        if (activeDisplayStatus &&
            incomingProcessingStatus.type === activeDisplayStatus.type &&
            incomingProcessingStatus.stage === activeDisplayStatus.stage /* Adicione mais campos se necessário para esta comparação */
        ) {
            // Se o tipo é o mesmo, apenas atualiza para que os filhos recebam os detalhes mais recentes.
            // Não resetamos o timer de tipo aqui, pois o tipo não mudou.
            if (JSON.stringify(incomingProcessingStatus) !== JSON.stringify(activeDisplayStatus)) {
                setActiveDisplayStatus(incomingProcessingStatus);
            }
            return;
        }


        // Lógica para troca de TIPO de indicador
        const incomingType = incomingProcessingStatus.type;
        const activeType = activeDisplayStatus?.type;

        if (indicatorTypeChangeTimeoutRef.current) {
            clearTimeout(indicatorTypeChangeTimeoutRef.current);
        }

        if (activeType && incomingType !== activeType && lastIndicatorTypeSetTimeRef.current !== 0) {
            // Houve uma mudança no TIPO de indicador (ex: de function_call para file_processing)
            const now = Date.now();
            const timeSinceLastTypeSet = now - lastIndicatorTypeSetTimeRef.current;

            if (timeSinceLastTypeSet < MIN_INDICATOR_TYPE_DISPLAY_TIME) {
                const delay = MIN_INDICATOR_TYPE_DISPLAY_TIME - timeSinceLastTypeSet;
                indicatorTypeChangeTimeoutRef.current = setTimeout(() => {
                    setActiveDisplayStatus(incomingProcessingStatus);
                    lastIndicatorTypeSetTimeRef.current = Date.now();
                    currentIndicatorTypeRef.current = incomingProcessingStatus.type;
                }, delay);
            } else {
                // Tempo mínimo do tipo anterior já passou, atualiza imediatamente
                setActiveDisplayStatus(incomingProcessingStatus);
                lastIndicatorTypeSetTimeRef.current = now;
                currentIndicatorTypeRef.current = incomingProcessingStatus.type;
            }
        } else {
            // Caso inicial (activeDisplayStatus ainda não definido), ou tipo é o mesmo (já tratado),
            // ou é uma mudança para um tipo quando antes não havia nenhum.
            // Atualiza diretamente se o activeDisplayStatus for diferente do incoming.
            if (JSON.stringify(incomingProcessingStatus) !== JSON.stringify(activeDisplayStatus)) {
                setActiveDisplayStatus(incomingProcessingStatus);
            }
            // Se o lastIndicatorTypeSetTimeRef.current é 0, significa que é a primeira vez que um indicador deste tipo está sendo setado
            // ou o tipo anterior foi completamente removido.
            if (lastIndicatorTypeSetTimeRef.current === 0 || activeType !== incomingType) {
                lastIndicatorTypeSetTimeRef.current = Date.now();
                currentIndicatorTypeRef.current = incomingProcessingStatus.type;
            }
        }

        return () => {
            if (indicatorTypeChangeTimeoutRef.current) {
                clearTimeout(indicatorTypeChangeTimeoutRef.current);
            }
        };
        // Adicionamos activeDisplayStatus à lista de dependências para garantir que o effect rode
        // quando ele for alterado internamente por um timeout.
    }, [incomingProcessingStatus, activeDisplayStatus]);


    const isActualErrorForStyling = (typeof message.metadata?.error === 'string' && message.metadata.error !== "Resposta abortada pelo usuário.") || (typeof message.metadata?.error === 'boolean' && message.metadata.error === true);
    const abortedByUser = message.metadata?.abortedByUser;
    const userFacingErrorMessage = message.metadata?.userFacingError || (typeof message.metadata?.error === 'string' && message.metadata.error !== "Resposta abortada pelo usuário." ? message.metadata.error : undefined);
    const memoryActions = message.metadata?.memorizedMemoryActions;
    const hasMemoryActions = memoryActions && memoryActions.length > 0;
    const attachedFilesInfo: AttachedFileInfo[] | undefined = message.metadata?.attachedFilesInfo;
    const hasAttachedFiles = !!(attachedFilesInfo && attachedFilesInfo.length > 0);
    const rawParts: Part[] | undefined = message.metadata?.rawParts as Part[] | undefined;

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editedText, setEditedText] = useState<string>(message.text);
    const [showActions, setShowActions] = useState<boolean>(false);
    const editTextareaRef = useRef<HTMLTextAreaElement>(null);

    const [mediaModalOpen, setMediaModalOpen] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<AttachedFileInfo | null>(null);

    const openMediaModal = (fileInfo: AttachedFileInfo) => {
        if ((fileInfo.type.startsWith('image/') || fileInfo.type.startsWith('video/')) && fileInfo.dataUrl) {
            setSelectedMedia(fileInfo);
            setMediaModalOpen(true);
        }
    };

    const closeMediaModal = () => {
        setMediaModalOpen(false);
        setSelectedMedia(null);
    };

    const adjustEditareaHeight = (): void => {
        if (isEditing && editTextareaRef.current) {
            editTextareaRef.current.style.height = 'auto';
            const maxHeight = Math.max(100, window.innerHeight * 0.2);
            editTextareaRef.current.style.height = `${Math.min(editTextareaRef.current.scrollHeight, maxHeight)}px`;
            editTextareaRef.current.style.overflowY = editTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    };

    useEffect(adjustEditareaHeight, [isEditing, editedText]);

    useEffect(() => {
        if (isEditing && editTextareaRef.current) {
            const { current } = editTextareaRef;
            current.focus();
            current.setSelectionRange(current.value.length, current.value.length);
        }
    }, [isEditing]);

    const handleDelete = (): void => {
        if (isFunctionRole && !window.confirm('Tem certeza que deseja excluir esta mensagem de função? Isso pode afetar a continuidade da IA.')) {
            return;
        }
        if (window.confirm('Tem certeza que deseja excluir esta mensagem?')) {
            removeMessageById(conversationId, message.id);
        }
    };

    const handleEdit = (): void => {
        if (isFunctionRole) return;
        if (!isUser && abortedByUser && message.text.trim() === "Resposta abortada pelo usuário.") {
            setEditedText("");
        } else {
            setEditedText(message.text.replace(/▍$/, ''));
        }
        setIsEditing(true);
    };

    const handleSaveEdit = async (): Promise<void> => {
        const newText = editedText.trim();
        setIsEditing(false);
        if (newText === '' && !hasAttachedFiles) {
            if (message.text.replace(/▍$/, '').trim() !== '' && window.confirm('O texto está vazio e não há anexos. Deseja excluir a mensagem?')) {
                removeMessageById(conversationId, message.id);
            }
            return;
        }
        if (isUser) {
            await regenerateResponseForEditedMessage(conversationId, message.id, newText);
        } else {
            const newMetadata: Partial<MessageMetadata> = {
                ...message.metadata,
                abortedByUser: false,
                error: false, // Limpa erro ao editar manualmente
                userFacingError: undefined,
                processingStatus: undefined // Limpa status de processamento ao editar manualmente
            };
            if (isLoading) newMetadata.isLoading = false;
            updateMessageInConversation(conversationId, message.id, { text: newText, metadata: newMetadata });
        }
    };

    const handleCancelEdit = (): void => {
        setEditedText(message.text.replace(/▍$/, ''));
        setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
        else if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
    };

    const isThisUserMessageBeingReprocessed = isUser && isProcessingEditedMessage && (activeConversation?.messages.some((m) => m.id === message.id) ?? false) && Boolean(activeConversation?.messages[activeConversation.messages.length - 1]?.metadata?.isLoading) && ((activeConversation?.messages.findIndex((m) => m.id === message.id) ?? 0) < ((activeConversation?.messages.length ?? 1) - 1));

    const showActivityIndicator = !isUser && !isFunctionRole && isLoading && activeDisplayStatus &&
        (activeDisplayStatus.stage === 'pending' || activeDisplayStatus.stage === 'in_progress' || activeDisplayStatus.stage === 'awaiting_ai');

    const currentMessageText = message.text.replace(/▍$/, '').trim();
    const isLogMessage = currentMessageText.startsWith("[Loox:");

    let textForDisplay = currentMessageText;
    textForDisplay = textForDisplay.replace(/\[Loox:\s*.*?\]/g, "").trim();
    textForDisplay = textForDisplay.replace(/\[MEMORIZE:\s*"[^"]+"\]/g, "").trim();
    textForDisplay = textForDisplay.replace(/\[UPDATE_MEMORY original:\s*"[^"]+"\s*new:\s*"[^"]+"\]/g, "").trim();
    textForDisplay = textForDisplay.replace(/\[DELETE_MEMORY:\s*"[^"]+"\]/g, "").trim();
    const sanitizedMessageText = textForDisplay;

    let renderUserTextPortion = sanitizedMessageText.length > 0;
    if (showActivityIndicator) {
        if (isLogMessage && sanitizedMessageText.length === 0) {
            renderUserTextPortion = false;
        }
    }

    const shouldRenderTextContent = renderUserTextPortion ||
        (!isUser && !isFunctionRole && (userFacingErrorMessage || (abortedByUser && !isEditing))) ||
        (isFunctionRole && !(rawParts?.find((p): p is Part & { functionResponse: FunctionResponse } => (p as Part).functionResponse !== undefined)));

    const functionCallPart = rawParts?.find((p): p is Part & { functionCall: FunctionCall } => (p as Part).functionCall !== undefined);
    const functionResponsePart = rawParts?.find((p): p is Part & { functionResponse: FunctionResponse } => (p as Part).functionResponse !== undefined);

    const showAITypingIndicator = !isUser && !isFunctionRole && isLoading && !showActivityIndicator &&
        !functionCallPart && !functionResponsePart && !shouldRenderTextContent;

    const canPerformActionsOnMessage = !isFunctionRole && !isLoading && !isActualErrorForStyling && !isProcessingEditedMessage && !isThisUserMessageBeingReprocessed && !showActivityIndicator;
    const syntaxHighlightEnabledGlobally = !isGeneratingResponse && settings.codeSynthaxHighlightEnabled;
    
    const markdownComponents: Components = {
        code: ({ inline, className, children, ...props }: CustomCodeRendererProps) => {
            const codeString = React.Children.toArray(children).join('');
            let isLikelyInline = !!inline;

            if (typeof inline !== 'boolean' || !inline) {
                isLikelyInline = (!className || !className.startsWith('language-')) && !codeString.includes('\n');
            }

            if (!isUser && isLoading && !syntaxHighlightEnabledGlobally) { // AI loading, syntax highlight off
                if (isLikelyInline) {
                    return (
                        <code {...props} className={`font-mono text-inherit px-1 bg-[var(--color-inline-code-loading-bg)] rounded-sm ${className || ''}`}>
                            {children}
                        </code>
                    );
                } else {
                    return (
                        <pre className="bg-[var(--color-code-block-loading-bg)] p-3 my-2 rounded-md overflow-x-auto border border-[var(--color-code-block-loading-border)]">
                            <code className={`whitespace-pre-wrap break-words text-[var(--color-code-block-loading-text)] ${className || ''}`} {...props}>
                                {codeString.replace(/\n$/, '')}
                            </code>
                        </pre>
                    );
                }
            } else { // User message OR AI done OR syntax highlight on
                if (isLikelyInline) {
                    return (
                        <code
                            className={`bg-[var(--color-inline-code-bg)] text-[var(--color-inline-code-text)] px-1.5 py-0.5 rounded-md font-mono text-xs sm:text-sm mx-0.5 align-baseline shadow-sm border border-[var(--color-inline-code-border)] ${className || ''}`}
                            {...props}
                        >
                            {children}
                        </code>
                    );
                }

                return (
                    <CodeBlock
                        className={className}
                        enableSynthaxHighlight={syntaxHighlightEnabledGlobally}
                        {...props}
                    >
                        {codeString.replace(/\n$/, '')}
                    </CodeBlock>
                );
            }
        },
        p: ({ node, children, ...props }: { node?: any; children?: React.ReactNode;[key: string]: any }) => {
            if (node && node.children && node.children.length === 1) {
                const childNode = node.children[0];
                if (childNode && childNode.type === 'element' && childNode.tagName === 'code') {
                    const codeContent = React.Children.toArray(childNode.children).join('');
                    const isChildInline = (!childNode.properties?.className || !String(childNode.properties.className).startsWith('language-')) && !codeContent.includes('\n');

                    if (!isChildInline) {
                        return <>{children}</>;
                    }
                }
            }
            return <p className="mb-2 last:mb-0 leading-relaxed" {...props}>{children}</p>;
        },
        h1: (props) => <h1 className="text-2xl font-semibold mt-4 mb-2" {...props} />,
        h2: (props) => <h2 className="text-xl font-semibold mt-3 mb-1.5" {...props} />,
        h3: (props) => <h3 className="text-lg font-semibold mt-2 mb-1" {...props} />,
        ul: (props) => <ul className="list-disc list-inside my-2 pl-5 space-y-1" {...props} />,
        ol: (props) => <ol className="list-decimal list-inside my-2 pl-5 space-y-1" {...props} />,
        li: (props) => <li className="pb-0.5" {...props} />,
        a: (props) => <a className="text-[var(--color-link-text)] hover:text-[var(--color-link-hover-text)] underline hover:no-underline" target="_blank" rel="noopener noreferrer" {...props} />,
        blockquote: (props) => <blockquote className="border-l-4 border-[var(--color-blockquote-border)] pl-4 my-2 italic text-[var(--color-blockquote-text)]" {...props} />,
        table: (props) => <div className="overflow-x-auto my-3 shadow rounded-md border border-[var(--color-table-border)]"><table className="table-auto w-full border-collapse" {...props} /></div>,
        thead: (props) => <thead className="bg-[var(--color-table-head-bg)]" {...props} />,
        th: (props) => <th className="border border-[var(--color-table-cell-border)] px-3 py-2 text-left text-sm font-medium text-[var(--color-table-header-text)]" {...props} />,
        td: (props) => <td className="border border-[var(--color-table-cell-border)] px-3 py-2 text-sm text-[var(--color-table-cell-text)]" {...props} />,
        strong: (props) => <strong className="font-semibold text-[var(--color-strong-text)]" {...props} />,
        em: (props) => <em className="italic" {...props} />,
    };

    let mainMemoryActionLabel = "Operações de memória:";
    let MainActionIcon = IoGitNetworkOutline;
    if (hasMemoryActions && memoryActions) {
        const actionsSet = new Set(memoryActions.map(a => a.action));
        if (actionsSet.size === 1) {
            const singleAction = actionsSet.values().next().value as MemoryActionType;
            if (singleAction === 'created') { mainMemoryActionLabel = memoryActions.length > 1 ? "Novas memórias:" : "Nova memória:"; MainActionIcon = IoCreateOutline; }
            else if (singleAction === 'updated') { mainMemoryActionLabel = memoryActions.length > 1 ? "Memórias atualizadas:" : "Memória atualizada:"; MainActionIcon = IoInformationCircleOutline; }
            else if (singleAction === 'deleted_by_ai') { mainMemoryActionLabel = memoryActions.length > 1 ? "Memórias removidas (IA):" : "Memória removida (IA):"; MainActionIcon = IoRemoveCircleOutline; }
        } else if (actionsSet.size > 1) {
            mainMemoryActionLabel = "Múltiplas ações de memória:";
            const firstAction = memoryActions[0].action;
            if (firstAction === 'created') MainActionIcon = IoCreateOutline;
            else if (firstAction === 'updated') MainActionIcon = IoInformationCircleOutline;
            else if (firstAction === 'deleted_by_ai') MainActionIcon = IoRemoveCircleOutline;
        }
    }

    const hasAnyContentForBubble = hasAttachedFiles || shouldRenderTextContent || showAITypingIndicator || functionCallPart || functionResponsePart || showActivityIndicator;
    
    const userBubbleClasses = "bg-[var(--color-message-bubble-user-bg)] text-[var(--color-message-bubble-user-text)] shadow-md";
    const aiBubbleBaseClasses = "bg-[var(--color-message-bubble-ai-bg)] text-[var(--color-message-bubble-ai-text)] shadow-md border border-[var(--color-message-bubble-ai-border)]";
    const functionRoleBubbleClasses = "bg-[var(--color-message-bubble-function-bg)] text-[var(--color-message-bubble-function-text)] shadow-md border border-[var(--color-message-bubble-function-border)]"; // Lighter indigo
    const errorBubbleClasses = "!bg-[var(--color-message-bubble-error-bg)] !border-[var(--color-message-bubble-error-border)] text-[var(--color-message-bubble-error-text)]";
    const abortedBubbleClasses = "border-2 border-dashed border-[var(--color-message-bubble-aborted-border)] !bg-[var(--color-message-bubble-aborted-bg)] text-[var(--color-message-bubble-aborted-text)] shadow-[var(--color-message-bubble-aborted-shadow)]";
    const baseLoadingPulse = isLoading && !isUser && !showActivityIndicator && !userFacingErrorMessage && !abortedByUser && !isEditing && !functionCallPart && !functionResponsePart;
    
    const messageContainerClasses = `py-3 px-4 rounded-2xl relative prose prose-sm w-full
                               transition-all duration-200 ease-in-out 
                               prose-p:text-[var(--color-prose-p-text)] prose-headings:text-[var(--color-prose-headings-text)] 
                               ${isUser ? userBubbleClasses : (isFunctionRole ? functionRoleBubbleClasses : aiBubbleBaseClasses)}
                               ${isActualErrorForStyling ? errorBubbleClasses : ''}
                               ${abortedByUser && !isEditing ? abortedBubbleClasses : ''}
                               ${baseLoadingPulse ? 'opacity-60 animate-pulse !bg-[var(--color-message-bubble-loading-bg)] border border-[var(--color-message-bubble-loading-border)]' : ''}`;
    
    const editContainerClasses = `p-2 rounded-xl shadow-xl border-2 border-[var(--color-message-bubble-edit-border)] w-full
                             ${isUser ? 'bg-[var(--color-message-bubble-user-edit-bg)]' : 'bg-[var(--color-message-bubble-ai-edit-bg)]'} backdrop-blur-sm`;
    
    const editTextareaClasses = `w-full p-2.5 text-sm bg-transparent focus:outline-none resize-none scrollbar-thin
                             ${isUser ? 'text-[var(--color-message-bubble-user-edit-text)] placeholder-[var(--color-message-bubble-user-edit-placeholder)] scrollbar-thumb-[var(--color-message-bubble-user-edit-scrollbar-thumb)] scrollbar-track-[var(--color-message-bubble-user-edit-scrollbar-track)]' 
                                     : 'text-[var(--color-message-bubble-ai-edit-text)] placeholder-[var(--color-message-bubble-ai-edit-placeholder)] scrollbar-thumb-[var(--color-message-bubble-ai-edit-scrollbar-thumb)] scrollbar-track-[var(--color-message-bubble-ai-edit-scrollbar-track)]'}`;
    
    const editButtonClasses = `!p-2 rounded-lg transform active:scale-90 transition-all
                           ${isUser ? 'text-[var(--color-message-bubble-user-edit-button-text)] hover:text-[var(--color-message-bubble-user-edit-button-hover-text)] hover:!bg-[var(--color-message-bubble-user-edit-button-hover-bg)]' 
                                   : 'text-[var(--color-message-bubble-ai-edit-button-text)] hover:text-[var(--color-message-bubble-ai-edit-button-hover-text)] hover:!bg-[var(--color-message-bubble-ai-edit-button-hover-bg)]'}`;
    
    const desktopMaxWidthClasses = 'max-w-[85%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%]';

    return (
        <>
            <div
                className="group/messageBubble relative flex flex-col mb-5 sm:mb-6 last:mb-2"
                onMouseEnter={() => { if (canPerformActionsOnMessage || (!isUser && !isFunctionRole && abortedByUser)) { setShowActions(true); } }}
                onMouseLeave={() => setShowActions(false)}
            >
                {hasAnyContentForBubble && (
                    <div className={`flex w-full ${isMobile
                        ? (isUser || isFunctionRole ? 'flex-col items-end' : 'flex-col items-start')
                        : (isUser || isFunctionRole
                            ? `flex-row items-end justify-end ${desktopMaxWidthClasses} ml-auto`
                            : `flex-row items-end justify-start ${desktopMaxWidthClasses} mr-auto`
                        )
                        } gap-2 sm:gap-2.5`}>

                        {(!isUser && !isFunctionRole) && (
                            settings.aiAvatarUrl && !aiAvatarLoadError ? (
                                <img
                                    src={settings.aiAvatarUrl}
                                    alt="AI Avatar"
                                    className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shadow-md border-2 border-white/50 transform group-hover/messageBubble:scale-105 transition-transform duration-200 ${isMobile ? 'self-start' : ''}`}
                                    onError={() => setAiAvatarLoadError(true)}
                                />
                            ) : (
                                <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[var(--color-default-ai-avatar-gradient-from)] to-[var(--color-default-ai-avatar-gradient-to)] flex items-center justify-center text-white shadow-md border-2 border-white/50 transform group-hover/messageBubble:scale-105 transition-transform duration-200 ${isMobile ? 'self-start' : ''}`}>
                                    <IoSparklesOutline size={isMobile ? 16 : 18} />
                                </div>
                            )
                        )}
                        {isFunctionRole && (
                            <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[var(--color-function-role-avatar-gradient-from)] to-[var(--color-function-role-avatar-gradient-to)] flex items-center justify-center text-white shadow-md border-2 border-white/50 transform group-hover/messageBubble:scale-105 transition-transform duration-200 ${isMobile ? 'self-end order-first' : ''}`}>
                                <IoGitCommitOutline size={isMobile ? 16 : 18} />
                            </div>
                        )}

                        {isUser && isMobile && (
                            <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[var(--color-user-avatar-gradient-from)] to-[var(--color-user-avatar-gradient-to)] flex items-center justify-center text-white shadow-md border-2 border-white/50 transform group-hover/messageBubble:scale-105 transition-transform duration-200 ${isEditing ? '!-mb-1' : ''} self-end order-first`} >
                                <IoPersonCircleOutline size={isMobile ? 18 : 20} />
                            </div>
                        )}

                        <div className={`flex flex-col w-full ${isMobile ? (isUser || isFunctionRole ? 'items-end' : 'items-start') : (isUser || isFunctionRole ? 'items-end' : 'items-start')}`}>
                            {hasAttachedFiles && attachedFilesInfo && (
                                <div className={`flex flex-wrap gap-2 mb-1.5 ${isUser || isFunctionRole ? 'justify-end' : 'justify-start'}`}>
                                    {attachedFilesInfo.map((fileInfo: AttachedFileInfo) => (
                                        <div key={fileInfo.id} className="bg-[var(--color-attached-file-bg)] border border-[var(--color-attached-file-border)] p-1.5 rounded-xl shadow-sm overflow-hidden max-w-[260px] sm:max-w-xs backdrop-blur-sm">
                                            {fileInfo.type.startsWith('image/') && fileInfo.dataUrl ? (
                                                <img
                                                    src={fileInfo.dataUrl}
                                                    alt={`Preview ${fileInfo.name}`}
                                                    className="object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                                    style={{ maxWidth: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE}px`, maxHeight: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE}px`, display: 'block' }}
                                                    title={`${fileInfo.name} (${(fileInfo.size / 1024).toFixed(1)} KB) - Clique para ampliar`}
                                                    onClick={() => openMediaModal(fileInfo)}
                                                />
                                            ) : fileInfo.type.startsWith('video/') && fileInfo.dataUrl ? (
                                                <div
                                                    className="relative w-full h-full object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center bg-black"
                                                    style={{ maxWidth: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE}px`, maxHeight: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE}px` }}
                                                    title={`${fileInfo.name} (${(fileInfo.size / 1024).toFixed(1)} KB) - Clique para reproduzir`}
                                                    onClick={() => openMediaModal(fileInfo)}
                                                >
                                                    <video
                                                        src={fileInfo.dataUrl}
                                                        className="object-contain rounded-md pointer-events-none"
                                                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                                                        <IoVideocamOutline size={30} className="text-white/80" />
                                                    </div>
                                                </div>
                                            ) : fileInfo.type.startsWith('audio/') && fileInfo.dataUrl ? (
                                                <div className="audio-player-container-in-bubble rounded-md w-full" title={`${fileInfo.name} (${(fileInfo.size / 1024).toFixed(1)} KB)`}>
                                                    <CustomAudioPlayer src={fileInfo.dataUrl} fileName={fileInfo.name} />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-xs p-2 text-center bg-[var(--color-attached-file-generic-icon-bg)] rounded-md" style={{ width: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE * 0.9}px`, height: `${MAX_THUMBNAIL_SIZE_IN_BUBBLE * 0.9}px`, minWidth: '70px' }} title={`${fileInfo.name} (${(fileInfo.size / 1024).toFixed(1)} KB)`}>
                                                    {fileInfo.type.startsWith('image/') ? <IoImageOutline size={26} className="mb-1 text-[var(--color-attached-file-generic-icon)]" />
                                                        : fileInfo.type.startsWith('video/') ? <IoVideocamOutline size={26} className="mb-1 text-[var(--color-attached-file-generic-icon)]" />
                                                            : fileInfo.type.startsWith('audio/') ? <IoMusicalNotesOutline size={26} className="mb-1 text-[var(--color-attached-file-generic-icon)]" />
                                                                : <IoDocumentTextOutline size={26} className="mb-1 text-[var(--color-attached-file-generic-icon)]" />}
                                                    <span className="truncate block w-full text-[var(--color-attached-file-generic-name)] text-[11px]">{fileInfo.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={`relative flex ${isUser || isFunctionRole ? 'justify-end' : 'justify-start'} max-w-full ${isUser && hasAttachedFiles ? 'mt-0' : ''} `}>
                                {isEditing && !isThisUserMessageBeingReprocessed ? (
                                    <div className={editContainerClasses}>
                                        <textarea ref={editTextareaRef} value={editedText} onChange={(e) => setEditedText(e.target.value)} onKeyDown={handleEditKeyDown} className={editTextareaClasses} rows={1} aria-label="Editar mensagem" />
                                        <div className="flex justify-end gap-1.5 mt-2 px-1">
                                            <Button variant='icon' onClick={handleCancelEdit} className={editButtonClasses} title="Cancelar edição (Esc)"> <IoCloseOutline size={20} /> </Button>
                                            <Button variant='icon' onClick={handleSaveEdit} className={`${editButtonClasses} ${editedText.trim() === '' && !hasAttachedFiles ? '!text-gray-400 !bg-gray-200/50 cursor-not-allowed' : (isUser ? '!bg-[var(--color-primary-dark)] hover:!bg-[var(--color-primary-dark)]' : '!bg-[var(--color-gray-300)] hover:!bg-[var(--color-gray-400)]')}`} title="Salvar edição (Enter)" disabled={isProcessingEditedMessage || (editedText.trim() === '' && !hasAttachedFiles && message.text === '')}> <IoCheckmarkOutline size={20} /> </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={messageContainerClasses}>
                                        {isThisUserMessageBeingReprocessed && (<div className="absolute -top-1.5 -right-1.5 p-0.5 bg-[var(--color-message-bubble-reprocess-icon-bg)] rounded-full shadow z-10"> <IoSyncOutline size={12} className="text-[var(--color-message-bubble-reprocess-icon-text)] animate-spin" /> </div>)}

                                        {showActivityIndicator && activeDisplayStatus && (
                                            <>
                                                {(activeDisplayStatus.type === 'function_call_request' ||
                                                    activeDisplayStatus.type === 'function_call_execution' ||
                                                    activeDisplayStatus.type === 'function_call_response') &&
                                                    <FunctionCallActivityIndicator status={activeDisplayStatus} />
                                                }
                                                {(activeDisplayStatus.type === 'user_attachment_upload' ||
                                                    activeDisplayStatus.type === 'file_from_function_processing') &&
                                                    <FileProcessingActivityIndicator status={activeDisplayStatus} />
                                                }
                                            </>
                                        )}

                                        {functionCallPart && !showActivityIndicator && (
                                            <div
                                                className="function-call-request-display flex flex-col gap-1 p-2.5 my-1.5 rounded-lg border text-xs shadow-sm bg-[var(--color-function-call-request-bg)] border-[var(--color-function-call-request-border)] text-[var(--color-function-call-request-text)]"
                                                title={`Chamada para a função: ${functionCallPart.functionCall.name}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <IoTerminalOutline size={18} className="flex-shrink-0 text-[var(--color-function-call-request-icon)]" />
                                                    <span className="font-semibold text-[var(--color-function-call-request-text)]">Chamada de Função Solicitada:</span>
                                                </div>
                                                <div className="pl-[calc(1.125rem+0.5rem)]">
                                                    <p className="text-sm font-medium text-[var(--color-function-call-request-name)]">{functionCallPart.functionCall.name}</p>
                                                </div>
                                            </div>
                                        )}

                                        {functionResponsePart && (
                                            <div className="function-response-content p-1">
                                                <div className="flex items-center text-xs text-[var(--color-function-response-text)] mb-1.5">
                                                    <IoGitCommitOutline size={16} className="mr-1.5 flex-shrink-0" />
                                                    <span className="font-semibold">Resposta da Função Recebida:</span>
                                                </div>
                                                <p className="text-sm font-medium text-[var(--color-function-response-name)]">{functionResponsePart.functionResponse.name}</p>
                                            </div>
                                        )}

                                        {showAITypingIndicator && (
                                            <div className="typing-dots flex items-center space-x-1.5 h-6">
                                                <span className="block w-2.5 h-2.5 bg-current rounded-full animate-bounce delay-0"></span>
                                                <span className="block w-2.5 h-2.5 bg-current rounded-full animate-bounce delay-200"></span>
                                                <span className="block w-2.5 h-2.5 bg-current rounded-full animate-bounce delay-400"></span>
                                            </div>
                                        )}

                                        {shouldRenderTextContent && (
                                            <div className="message-text-content">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm, remarkBreaks]}
                                                    components={markdownComponents}
                                                >
                                                    {sanitizedMessageText}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {userFacingErrorMessage && isActualErrorForStyling && (
                                            <div className={`mt-2.5 text-xs ${message.text.trim().length > 0 || showActivityIndicator ? 'border-t border-[var(--color-error-message-border)] pt-2' : ''} text-[var(--color-error-message-text)]`}>
                                                <strong>Erro:</strong> {userFacingErrorMessage}
                                            </div>
                                        )}
                                        {abortedByUser && !isEditing && (
                                            <div className={`mt-2.5 text-xs ${message.text.trim().length > 0 || showActivityIndicator ? 'border-t border-[var(--color-aborted-message-border)] pt-2' : ''} text-[var(--color-aborted-message-text)]`}>
                                                Resposta abortada pelo usuário.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {isUser && !isMobile && (
                            <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[var(--color-user-avatar-gradient-from)] to-[var(--color-user-avatar-gradient-to)] flex items-center justify-center text-white shadow-md border-2 border-white/50 self-end transform group-hover/messageBubble:scale-105 transition-transform duration-200 ${isEditing ? '!-mb-1' : ''}`} >
                                <IoPersonCircleOutline size={isMobile ? 18 : 20} />
                            </div>
                        )}

                        {((canPerformActionsOnMessage || (!isUser && !isFunctionRole && abortedByUser)) && showActions && !isEditing) && (
                            <div className={`flex items-center rounded-xl shadow-lg bg-[var(--color-message-actions-bg)] border border-[var(--color-message-actions-border)] p-1 absolute transform transition-all duration-150 ease-out z-10 backdrop-blur-sm
                                        ${isUser ?
                                    (isMobile ? 'right-0 top-4' : 'right-11 -top-6') :
                                    (isMobile ? 'left-0 top-4' : 'left-11 sm:left-12 -top-6')
                                }
                                        ${showActions ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 -translate-y-2 pointer-events-none'}`}>
                                {!isFunctionRole && <Button variant='icon' onClick={handleEdit} className="!p-1.5 text-[var(--color-message-actions-button-text)] hover:!text-[var(--color-message-actions-edit-button-hover-text)] hover:!bg-[var(--color-message-actions-edit-button-hover-bg)]" title="Editar mensagem" disabled={isProcessingEditedMessage || (!isUser && isThisUserMessageBeingReprocessed)}> <IoPencilOutline size={16} /> </Button>}
                                <Button variant='icon' onClick={handleDelete} className="!p-1.5 text-[var(--color-message-actions-button-text)] hover:!text-[var(--color-message-actions-delete-button-hover-text)] hover:!bg-[var(--color-message-actions-delete-button-hover-bg)]" title="Excluir mensagem" disabled={isProcessingEditedMessage}> <IoTrashOutline size={16} /> </Button>
                            </div>
                        )}
                    </div>
                )}

                {!isUser && !isFunctionRole && hasMemoryActions && memoryActions && (
                    <div className={`mt-3 animate-fadeInQuick ${isMobile
                        ? 'w-full'
                        : (isUser || isFunctionRole
                            ? `${desktopMaxWidthClasses} ml-auto`
                            : `ml-11 sm:ml-12 ${desktopMaxWidthClasses} mr-auto`
                        )
                        }`}>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-memory-actions-heading-text)] mb-1">
                            <MainActionIcon size={15} />
                            <span className="font-medium">{mainMemoryActionLabel}</span>
                        </div>
                        <ul className="text-xs space-y-0.5">
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
            <MediaModal
                isOpen={mediaModalOpen}
                onClose={closeMediaModal}
                mediaUrl={selectedMedia?.dataUrl}
                mediaName={selectedMedia?.name}
                mediaType={selectedMedia?.type}
            />
        </>
    );
};

export default MessageBubble;
