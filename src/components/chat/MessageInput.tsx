/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/chat/MessageInput.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import useIsMobile from '../../hooks/useIsMobile';

import InputErrorDisplay from './InputErrorDisplay';
import AttachedFilesPreview from './AttachedFilesPreview';
import MessageInputForm from './MessageInputForm';
import { MediaModal } from '../common/MediaModal';

import { useFileAttachments, type LocalAttachedFile } from '../../hooks/useFileAttachments';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { useMessageSubmission } from '../../hooks/useMessageSubmission';

const UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM = 2.5; // Approx 40px for 16px base
const FOCUSED_TEXTAREA_MAX_HEIGHT_VH = 40;
const MAX_THUMBNAIL_SIZE = 80; // pixels

const getPixelValueFromRem = (rem: number) => {
    if (typeof window !== 'undefined') {
        return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
    }
    return rem * 16; // Fallback for SSR or tests
};

const MessageInput: React.FC = () => {
    const { conversations, activeConversationId, isProcessingEditedMessage: isProcessingEditedMessageContext } = useConversations();
    const { settings } = useAppSettings();
    // useMemories is used internally by useMessageSubmission

    const [text, setText] = useState<string>('');
    const [isTextareaFocused, setIsTextareaFocused] = useState<boolean>(false);
    const [isWebSearchEnabledForNextMessage, setIsWebSearchEnabledForNextMessage] = useState<boolean>(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [mediaModalOpenInput, setMediaModalOpenInput] = useState(false);
    const [selectedMediaInput, setSelectedMediaInput] = useState<LocalAttachedFile | null>(null);

    const isMobile = useIsMobile();

    // --- Custom Hooks ---
    const {
        isRecording,
        audioError,
        setAudioError,
        startRecording,
        stopRecordingAndAttach,
        handleCancelRecording,
        stopMediaStream,
    } = useAudioRecording({
        addFilesToState: (files, isRecorded) => fileAttachments.addFilesToState(files, isRecorded),
        focusTextarea: () => textareaRef.current?.focus(),
    });

    const fileAttachments = useFileAttachments({
        enableAttachments: settings.enableAttachments,
        isRecordingAudio: isRecording,
        textareaFocused: isTextareaFocused,
    });

    const messageSubmission = useMessageSubmission({
        activeConversationId,
        conversations,
        text,
        attachedFiles: fileAttachments.attachedFiles,
        isWebSearchEnabledForNextMessage,
        onSubmissionStart: () => {
            setText('');
            fileAttachments.clearAttachmentsFromState();
            if (isWebSearchEnabledForNextMessage) setIsWebSearchEnabledForNextMessage(false); // Reset after use
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.overflowY = 'hidden';
            }
        },
        onSubmissionEnd: ({ focusTextarea, errorOccurred }) => {
            if (focusTextarea && textareaRef.current && settings.apiKey && !errorOccurred && !isRecording && !messageSubmission.isLoadingAI) {
                 if (document.body.contains(textareaRef.current)) { // Check if still mounted
                    textareaRef.current.focus();
                }
            }
        },
    });
    // --- End Custom Hooks ---

    const openMediaModalInput = (fileInfo: LocalAttachedFile) => {
        if ((fileInfo.type.startsWith('image/') || fileInfo.type.startsWith('video/')) && fileInfo.previewUrl) {
            setSelectedMediaInput(fileInfo);
            setMediaModalOpenInput(true);
        }
    };

    const closeMediaModalInput = () => {
        setMediaModalOpenInput(false);
        setSelectedMediaInput(null);
    };

    const adjustTextareaHeight = useCallback(() => {
        if (textareaRef.current) {
            const currentTextarea = textareaRef.current;
            currentTextarea.style.height = 'auto';
            const scrollHeight = currentTextarea.scrollHeight;
            let currentMaxHeight;
            if (isTextareaFocused) {
                currentMaxHeight = window.innerHeight * (FOCUSED_TEXTAREA_MAX_HEIGHT_VH / 100);
            } else {
                currentMaxHeight = getPixelValueFromRem(UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM);
            }
            currentTextarea.style.height = `${Math.min(scrollHeight, currentMaxHeight)}px`;
            currentTextarea.style.overflowY = scrollHeight > currentMaxHeight ? 'auto' : 'hidden';
        }
    }, [isTextareaFocused]);

    useEffect(() => { adjustTextareaHeight(); }, [text, adjustTextareaHeight]);

    useEffect(() => {
        const handleResize = () => { adjustTextareaHeight(); };
        window.addEventListener('resize', handleResize);
        adjustTextareaHeight(); // Initial adjustment
        return () => { window.removeEventListener('resize', handleResize); };
    }, [adjustTextareaHeight]);

    useEffect(() => {
        if (text !== '' && messageSubmission.errorFromAI) { messageSubmission.setErrorFromAI(null); }
        if (text !== '' && audioError) { setAudioError(null); }
    }, [text, messageSubmission.errorFromAI, audioError, messageSubmission.setErrorFromAI, setAudioError]);

    // Paste handler setup
    useEffect(() => {
        const textareaElement = textareaRef.current;
        if (textareaElement && settings.enableAttachments) { // Check enableAttachments for paste
            const pasteHandler = fileAttachments.handlePasteInternal as unknown as EventListener;
            textareaElement.addEventListener('paste', pasteHandler);
            return () => { textareaElement.removeEventListener('paste', pasteHandler); };
        }
    }, [fileAttachments.handlePasteInternal, settings.enableAttachments]);
    
    // Cleanup media stream on component unmount (from audio recording hook)
    useEffect(() => {
        return () => {
            stopMediaStream(); // Ensure media stream is stopped
        };
    }, [stopMediaStream]);


    const handleActualSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isRecording) return; // Should not happen if button is disabled, but as a safeguard
        messageSubmission.handleSubmit();
    };

    const handleActualAbort = () => {
        messageSubmission.handleAbortAIResponse();
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isRecording || messageSubmission.isProcessingEditedMessage || messageSubmission.isLoadingAI) {
            if (e.key === 'Enter') e.preventDefault();
            return;
        }
        const hasTextContent = text.trim().length > 0;
        const hasFiles = (settings.enableAttachments || fileAttachments.attachedFiles.some(f => f.file.type.startsWith('audio/'))) && fileAttachments.attachedFiles.length > 0;
        const hasContent = hasTextContent || hasFiles;

        if (isMobile ? (e.key === 'Enter' && e.ctrlKey && hasContent) : (e.key === 'Enter' && !e.shiftKey && hasContent)) {
            e.preventDefault();
            handleActualSubmit();
        }
    };
    
    const handleMicButtonClick = () => {
        if (isRecording) {
            stopRecordingAndAttach();
        } else {
            // Clear other errors when starting recording
            messageSubmission.setErrorFromAI(null);
            startRecording();
        }
    };

    const handleFileChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!settings.enableAttachments) return; // Guard against direct call if button somehow enabled
        const files = event.target.files;
        if (!files) return;
        fileAttachments.addFilesToState(files);
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
        textareaRef.current?.focus();
    };


    const placeholderText =
        activeConversationId ?
            (settings.apiKey ? "Digite a mensagem..." : "Configure sua API Key.") :
            "Crie uma nova conversa.";

    const isCurrentlyLoadingOverall = messageSubmission.isLoadingAI || isProcessingEditedMessageContext;
    const canSubmitEffectively = (text.trim().length > 0 || ((settings.enableAttachments || fileAttachments.attachedFiles.some(f => f.file.type.startsWith('audio/'))) && fileAttachments.attachedFiles.length > 0)) &&
                                !!activeConversationId && !isCurrentlyLoadingOverall && !!settings.apiKey && !isRecording;

    const isAttachButtonDisabled = !activeConversationId || !settings.apiKey || isCurrentlyLoadingOverall || isRecording || !settings.enableAttachments;
    const isMicDisabled = !activeConversationId || !settings.apiKey || isCurrentlyLoadingOverall; // Recording can happen even if attachments are off
    const isWebSearchButtonDisabled = !activeConversationId || !settings.apiKey || isCurrentlyLoadingOverall || isRecording;


    return (
        <>
            <div className="px-2 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 border-t border-[var(--color-input-container-border)] bg-[var(--color-input-container-bg)] sticky bottom-0 shadow- ऊपर-md z-20">
                <InputErrorDisplay
                    aiError={messageSubmission.errorFromAI}
                    audioError={audioError}
                />

                <AttachedFilesPreview
                    attachedFiles={fileAttachments.attachedFiles}
                    onRemoveFile={fileAttachments.handleRemoveFile}
                    onOpenMediaPreview={openMediaModalInput}
                    maxThumbnailSize={MAX_THUMBNAIL_SIZE}
                    enableAttachments={settings.enableAttachments}
                    isRecording={isRecording}
                />

                <MessageInputForm
                    text={text}
                    onTextChange={setText}
                    onSubmit={handleActualSubmit}
                    onAbort={handleActualAbort}
                    onKeyDown={handleKeyDown}
                    onTextFocus={() => setIsTextareaFocused(true)}
                    onTextBlur={() => setIsTextareaFocused(false)}
                    textareaRef={textareaRef}
                    fileInputRef={fileInputRef}
                    onFileChange={handleFileChangeInput}
                    onAttachClick={() => fileInputRef.current?.click()}
                    isRecording={isRecording}
                    onMicButtonClick={handleMicButtonClick}
                    onCancelRecording={handleCancelRecording}
                    isCurrentlyLoading={isCurrentlyLoadingOverall}
                    placeholderText={placeholderText}
                    isTextareaFocused={isTextareaFocused}
                    enableWebSearch={settings.enableWebSearch}
                    isWebSearchEnabledForNextMessage={isWebSearchEnabledForNextMessage}
                    onToggleWebSearch={() => setIsWebSearchEnabledForNextMessage(prev => !prev)}
                    isWebSearchButtonDisabled={isWebSearchButtonDisabled}
                    enableAttachments={settings.enableAttachments}
                    isAttachButtonDisabled={isAttachButtonDisabled}
                    isMicDisabled={isMicDisabled}
                    canSubmitEffectively={canSubmitEffectively}
                    adjustTextareaHeight={adjustTextareaHeight}
                    getPixelValueFromRem={getPixelValueFromRem}
                    UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM={UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM}
                    FOCUSED_TEXTAREA_MAX_HEIGHT_VH={FOCUSED_TEXTAREA_MAX_HEIGHT_VH}
                    activeConversationId={activeConversationId}
                    apiKeyPresent={!!settings.apiKey}
                />

                {!settings.apiKey && activeConversationId && !isCurrentlyLoadingOverall && !isRecording && (
                    <p className="text-xs text-[var(--color-api-key-warning-text)] text-center mt-2.5 px-2">
                        Chave de API não configurada. Por favor, adicione sua chave nas <strong className="font-medium text-[var(--color-api-key-warning-strong-text)]">Configurações</strong> para interagir com a IA.
                    </p>
                )}
            </div>
            <MediaModal // Using the common MediaModal now
                isOpen={mediaModalOpenInput}
                onClose={closeMediaModalInput}
                mediaUrl={selectedMediaInput?.previewUrl}
                mediaName={selectedMediaInput?.name}
                mediaType={selectedMediaInput?.type}
            />
        </>
    );
};

export default MessageInput;
