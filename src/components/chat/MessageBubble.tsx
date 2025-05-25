// src/components/chat/MessageBubble.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
import type { Message, MessageMetadata, MemoryActionType, AttachedFileInfo, Part, ProcessingStatus } from '../../types';
import {
    IoPersonCircleOutline, IoSparklesOutline, IoGitNetworkOutline, IoTrashOutline,
    IoPencilOutline, IoCheckmarkOutline, IoCloseOutline, IoSyncOutline,
    IoCreateOutline, IoInformationCircleOutline, IoRemoveCircleOutline,
    IoDocumentTextOutline, IoImageOutline, IoMusicalNotesOutline, IoVideocamOutline, IoTerminalOutline,
    IoGitCommitOutline,
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMessageSubmission } from '../../hooks/useMessageSubmission'; // Added
import type { LocalAttachedFile } from '../../hooks/useFileAttachments'; // Added
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
        // regenerateResponseForEditedMessage, // Will be replaced by useMessageSubmission
        // isProcessingEditedMessage, // Will be replaced by useMessageSubmission's isLoadingAI
        activeConversation,
        conversations, // Added: needed for useMessageSubmission
        // isGeneratingResponse, // Removed from context, covered by message.metadata.isLoading or hook's isLoadingAI
    } = useConversations();
    const { settings } = useAppSettings();

    const isMobile = useIsMobile();

    const isUser = message.sender === 'user';
    const isFunctionRole = message.sender === 'function';
    const isLoading = message.metadata?.isLoading;
    const incomingProcessingStatus = message.metadata?.processingStatus;

    const [activeDisplayStatus, setActiveDisplayStatus] = useState<ProcessingStatus | undefined>(incomingProcessingStatus);
    const indicatorTypeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastIndicatorTypeSetTimeRef = useRef<number>(0);
    const currentIndicatorTypeRef = useRef<ProcessingStatus['type'] | undefined>(undefined);

    const [aiAvatarLoadError, setAiAvatarLoadError] = useState(false);

    useEffect(() => {
        setAiAvatarLoadError(false);
    }, [settings.aiAvatarUrl, message.id]);


    useEffect(() => {
        if (incomingProcessingStatus && !activeDisplayStatus) {
            setActiveDisplayStatus(incomingProcessingStatus);
            lastIndicatorTypeSetTimeRef.current = Date.now();
            currentIndicatorTypeRef.current = incomingProcessingStatus.type;
        }
    }, [incomingProcessingStatus, activeDisplayStatus]);


    useEffect(() => {
        if (!incomingProcessingStatus && activeDisplayStatus) {
            if (indicatorTypeChangeTimeoutRef.current) {
                clearTimeout(indicatorTypeChangeTimeoutRef.current);
            }
            setActiveDisplayStatus(undefined);
            currentIndicatorTypeRef.current = undefined;
            lastIndicatorTypeSetTimeRef.current = 0;
            return;
        }

        if (!incomingProcessingStatus) {
            return;
        }

        if (activeDisplayStatus &&
            incomingProcessingStatus.type === activeDisplayStatus.type &&
            incomingProcessingStatus.stage === activeDisplayStatus.stage
        ) {
            if (JSON.stringify(incomingProcessingStatus) !== JSON.stringify(activeDisplayStatus)) {
                setActiveDisplayStatus(incomingProcessingStatus);
            }
            return;
        }


        const incomingType = incomingProcessingStatus.type;
        const activeType = activeDisplayStatus?.type;

        if (indicatorTypeChangeTimeoutRef.current) {
            clearTimeout(indicatorTypeChangeTimeoutRef.current);
        }

        if (activeType && incomingType !== activeType && lastIndicatorTypeSetTimeRef.current !== 0) {
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
                setActiveDisplayStatus(incomingProcessingStatus);
                lastIndicatorTypeSetTimeRef.current = now;
            }
        } else {
            if (JSON.stringify(incomingProcessingStatus) !== JSON.stringify(activeDisplayStatus)) {
                setActiveDisplayStatus(incomingProcessingStatus);
            }
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
    // State for attachments if editing could change them. For now, assume no change.
    const [editedAttachedFiles, setEditedAttachedFiles] = useState<LocalAttachedFile[]>([]);


    const messageSubmission = useMessageSubmission({
        activeConversationId: conversationId,
        conversations,
        text: editedText,
        attachedFiles: editedAttachedFiles, // Pass empty if edits don't change files, or manage state for this
        isWebSearchEnabledForNextMessage: false, // Edits typically don't toggle web search
        onSubmissionStart: () => {
            setIsEditing(false);
        },
        onSubmissionEnd: () => {
            // Optional: focus management or other cleanup after edit submission
        },
        messageToEditId: message.id,
    });

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

        // Populate editedAttachedFiles with existing attachments as placeholders
        if (message.metadata?.attachedFilesInfo && message.metadata.attachedFilesInfo.length > 0) {
            const placeholderFiles: LocalAttachedFile[] = message.metadata.attachedFilesInfo.map(afi => ({
                id: afi.id,
                file: new File([], afi.name, { type: afi.type }), // Dummy file object for LocalAttachedFile structure
                name: afi.name,
                type: afi.type,
                size: afi.size,
                previewUrl: afi.dataUrl, // Use dataUrl as previewUrl for placeholders
                isPlaceholder: true,
            }));
            setEditedAttachedFiles(placeholderFiles);
        } else {
            setEditedAttachedFiles([]); // Ensure it's empty if no original attachments
        }

        setIsEditing(true);
    };

    const handleSaveEdit = async (): Promise<void> => {
        const newText = editedText.trim();
        setIsEditing(false);
        // `hasAttachedFiles` refers to the original message's attachments before edit started.
        // `editedAttachedFiles` is the current state for the edit UI (placeholders + any new files if UI supported adding them).
        if (newText === '' && editedAttachedFiles.length === 0) {
            // If both new text and current attachments for edit are empty
            if ((message.text.replace(/▍$/, '').trim() !== '' || (message.metadata?.attachedFilesInfo && message.metadata.attachedFilesInfo.length > 0)) && 
                window.confirm('O texto está vazio e não há anexos. Deseja excluir a mensagem?')) {
                removeMessageById(conversationId, message.id);
            }
            // If the message was already empty and had no attachments, and still is, do nothing.
            return;
        }

        if (isUser) {
            // The `messageSubmission` hook is already configured with `editedText` (from state)
            // and `editedAttachedFiles` (from state, now containing placeholders for original files)
            // via its props. Calling handleSubmit will use this current state.
            await messageSubmission.handleSubmit();
            // No need to call setEditedAttachedFiles([]) here, as onSubmissionStart in the hook should clear MessageInput's files,
            // and for MessageBubble, the edit mode is exited.

        } else { // Editing AI message (local update only)
            const newMetadata: Partial<MessageMetadata> = {
                ...message.metadata,
                abortedByUser: false,
                error: false,
                userFacingError: undefined,
                processingStatus: undefined
            };
            if (isLoading) newMetadata.isLoading = false;
            updateMessageInConversation(conversationId, message.id, { text: newText, metadata: newMetadata });
        }
    };

    const handleCancelEdit = (): void => {
        setEditedText(message.text.replace(/▍$/, ''));
        setEditedAttachedFiles([]); // Clear any staged attachments for edit
        setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
        else if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
    };

    // Use isLoadingAI from the submission hook for user messages being edited.
    // isProcessingEditedMessage from context is being removed.
    const isThisUserMessageBeingReprocessedByHook = isUser && messageSubmission.isLoadingAI && message.id === messageSubmission.messageToEditId;

    const currentMessageText = message.text.replace(/▍$/, '').trim();
    const isLogMessage = currentMessageText.startsWith("[Loox:");

    let textForDisplay = currentMessageText;
    textForDisplay = textForDisplay.replace(/\[Loox:\s*.*?\]/g, "").trim();
    textForDisplay = textForDisplay.replace(/\[MEMORIZE:\s*"[^"]+"\]/g, "").trim();
    textForDisplay = textForDisplay.replace(/\[UPDATE_MEMORY original:\s*"[^"]+"\s*new:\s*"[^"]+"\]/g, "").trim();
    textForDisplay = textForDisplay.replace(/\[DELETE_MEMORY:\s*"[^"]+"\]/g, "").trim();
    const sanitizedMessageText = textForDisplay;

    let renderUserTextPortion = sanitizedMessageText.length > 0;

    const functionCallPart = rawParts?.find((p): p is Part & { functionCall: FunctionCall } => (p as Part).functionCall !== undefined);
    const functionResponsePart = rawParts?.find((p): p is Part & { functionResponse: FunctionResponse } => (p as Part).functionResponse !== undefined);

    // Determine the processing status to display, prioritizing incoming status
    // If there's an incoming processing status, use it.
    // Otherwise, if there's a functionCallPart and indicators are enabled, create a 'completed' function_call_request status.
    const statusToDisplay: ProcessingStatus | undefined = incomingProcessingStatus ||
        (functionCallPart && settings.showProcessingIndicators
            ? { type: 'function_call_request', stage: 'completed', name: functionCallPart.functionCall.name }
            : undefined);

    // The main flag to show any activity indicator (including the new consolidated function call request)
    const showActivityIndicator = settings.showProcessingIndicators && !isUser && !isFunctionRole && isLoading && statusToDisplay &&
        (statusToDisplay.stage === 'pending' || statusToDisplay.stage === 'in_progress' || statusToDisplay.stage === 'awaiting_ai' || statusToDisplay.stage === 'completed');


    if (showActivityIndicator) {
        if (isLogMessage && sanitizedMessageText.length === 0) {
            renderUserTextPortion = false;
        }
    }

    const shouldRenderTextContent = renderUserTextPortion ||
        (!isUser && !isFunctionRole && (userFacingErrorMessage || (abortedByUser && !isEditing))) ||
        (isFunctionRole && !(rawParts?.find((p): p is Part & { functionResponse: FunctionResponse } => (p as Part).functionResponse !== undefined)));

    const showAITypingIndicator = !isUser && !isFunctionRole && isLoading && !showActivityIndicator &&
        !functionCallPart && !functionResponsePart && !shouldRenderTextContent;

    // Replace isProcessingEditedMessage and isThisUserMessageBeingReprocessed with hook's isLoadingAI
    const canPerformActionsOnMessage = !isFunctionRole && !isLoading && !isActualErrorForStyling && !messageSubmission.isLoadingAI && !showActivityIndicator;
    // Use message.metadata.isLoading (aliased as `isLoading` in this component) for syntax highlighting decisions
    const syntaxHighlightEnabledGlobally = !isLoading && settings.codeSynthaxHighlightEnabled; 
    
    const markdownComponents: Components = {
        code: ({ inline, className, children, ...props }: CustomCodeRendererProps) => {
            const codeString = React.Children.toArray(children).join('');
            let isLikelyInline = !!inline;

            if (typeof inline !== 'boolean' || !inline) {
                isLikelyInline = (!className || !className.startsWith('language-')) && !codeString.includes('\n');
            }

            if (!isUser && isLoading && !syntaxHighlightEnabledGlobally) {
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
            } else {
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
    const functionRoleBubbleClasses = "bg-[var(--color-message-bubble-function-bg)] text-[var(--color-message-bubble-function-text)] shadow-md border border-[var(--color-message-bubble-function-border)]";
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
                                {isEditing && !isThisUserMessageBeingReprocessedByHook ? (
                                    <div className={editContainerClasses}>
                                        <textarea ref={editTextareaRef} value={editedText} onChange={(e) => setEditedText(e.target.value)} onKeyDown={handleEditKeyDown} className={editTextareaClasses} rows={1} aria-label="Editar mensagem" />
                                        <div className="flex justify-end gap-1.5 mt-2 px-1">
                                            <Button variant='icon' onClick={handleCancelEdit} className={editButtonClasses} title="Cancelar edição (Esc)" disabled={messageSubmission.isLoadingAI}> <IoCloseOutline size={20} /> </Button>
                                            <Button variant='icon' onClick={handleSaveEdit} className={`${editButtonClasses} ${editedText.trim() === '' && !hasAttachedFiles && editedAttachedFiles.length === 0 ? '!text-gray-400 !bg-gray-200/50 cursor-not-allowed' : (isUser ? '!bg-[var(--color-primary-dark)] hover:!bg-[var(--color-primary-dark)]' : '!bg-[var(--color-gray-300)] hover:!bg-[var(--color-gray-400)]')}`} title="Salvar edição (Enter)" disabled={messageSubmission.isLoadingAI || (editedText.trim() === '' && !hasAttachedFiles && editedAttachedFiles.length === 0 && message.text === '')}> <IoCheckmarkOutline size={20} /> </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={messageContainerClasses}>
                                        {isThisUserMessageBeingReprocessedByHook && (<div className="absolute -top-1.5 -right-1.5 p-0.5 bg-[var(--color-message-bubble-reprocess-icon-bg)] rounded-full shadow z-10"> <IoSyncOutline size={12} className="text-[var(--color-message-bubble-reprocess-icon-text)] animate-spin" /> </div>)}

                                        {showActivityIndicator && statusToDisplay && (
                                            <>
                                                {(statusToDisplay.type === 'function_call_request' ||
                                                    statusToDisplay.type === 'function_call_execution' ||
                                                    statusToDisplay.type === 'function_call_response') &&
                                                    <FunctionCallActivityIndicator status={statusToDisplay} />
                                                }
                                                {(statusToDisplay.type === 'user_attachment_upload' ||
                                                    statusToDisplay.type === 'file_from_function_processing') &&
                                                    <FileProcessingActivityIndicator status={statusToDisplay} />
                                                }
                                            </>
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
                                {!isFunctionRole && <Button variant='icon' onClick={handleEdit} className="!p-1.5 text-[var(--color-message-actions-button-text)] hover:!text-[var(--color-message-actions-edit-button-hover-text)] hover:!bg-[var(--color-message-actions-edit-button-hover-bg)]" title="Editar mensagem" disabled={messageSubmission.isLoadingAI}> <IoPencilOutline size={16} /> </Button>}
                                <Button variant='icon' onClick={handleDelete} className="!p-1.5 text-[var(--color-message-actions-button-text)] hover:!text-[var(--color-message-actions-delete-button-hover-text)] hover:!bg-[var(--color-message-actions-delete-button-hover-bg)]" title="Excluir mensagem" disabled={messageSubmission.isLoadingAI}> <IoTrashOutline size={16} /> </Button>
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
