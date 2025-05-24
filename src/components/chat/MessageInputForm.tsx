// src/components/chat/MessageInputForm.tsx
import React, { useEffect } from 'react';
import Button from '../common/Button';
import {
    IoAttach,
    IoMicOutline,
    IoStopCircleOutline,
    IoClose,
    IoStop,
    IoPaperPlaneOutline,
    IoEarthOutline,
} from 'react-icons/io5';

interface MessageInputFormProps {
    text: string;
    onTextChange: (text: string) => void;
    onSubmit: (e?: React.FormEvent) => void;
    onAbort: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onTextFocus: () => void;
    onTextBlur: () => void;

    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onAttachClick: () => void;

    isRecording: boolean;
    onMicButtonClick: () => void;
    onCancelRecording: () => void;

    isCurrentlyLoading: boolean; // Combined AI loading or processing edited message
    placeholderText: string;
    isTextareaFocused: boolean;
    
    enableWebSearch: boolean;
    isWebSearchEnabledForNextMessage: boolean;
    onToggleWebSearch: () => void;
    isWebSearchButtonDisabled: boolean;

    enableAttachments: boolean;
    isAttachButtonDisabled: boolean;
    isMicDisabled: boolean;
    canSubmitEffectively: boolean;

    adjustTextareaHeight: () => void;
    getPixelValueFromRem: (rem: number) => number;
    UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM: number;
    FOCUSED_TEXTAREA_MAX_HEIGHT_VH: number;
    activeConversationId: string | null; // For disabling textarea
    apiKeyPresent: boolean; // For disabling textarea
}

const MessageInputForm: React.FC<MessageInputFormProps> = ({
    text, onTextChange, onSubmit, onAbort, onKeyDown, onTextFocus, onTextBlur,
    textareaRef, fileInputRef, onFileChange, onAttachClick,
    isRecording, onMicButtonClick, onCancelRecording,
    isCurrentlyLoading, placeholderText, isTextareaFocused,
    enableWebSearch, isWebSearchEnabledForNextMessage, onToggleWebSearch, isWebSearchButtonDisabled,
    enableAttachments, isAttachButtonDisabled, isMicDisabled, canSubmitEffectively,
    adjustTextareaHeight, getPixelValueFromRem, UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM, FOCUSED_TEXTAREA_MAX_HEIGHT_VH,
    activeConversationId, apiKeyPresent
}) => {

    useEffect(() => {
        adjustTextareaHeight();
    }, [text, isTextareaFocused, adjustTextareaHeight]);

    // Automatically focus the textarea when the active conversation changes
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [activeConversationId, textareaRef]);


    const recordingPlaceholder = (
        <div className="flex items-center text-sm text-[var(--color-input-placeholder)]">
            <div className="relative w-3 h-3 mr-2 flex items-center justify-center">
                <span className="absolute inline-flex w-2 h-2 bg-[var(--color-red-500)] rounded-full opacity-75 animate-ping"></span>
                <span className="relative inline-block w-2 h-2 bg-[var(--color-red-500)] rounded-full"></span>
            </div>
            <span className="whitespace-nowrap">Gravando áudio...</span>
        </div>
    );
    
    const effectivePlaceholder = isRecording ? '' : (isCurrentlyLoading ? 'IA respondendo...' : placeholderText);
    const textareaDisabled = !activeConversationId || !apiKeyPresent || isCurrentlyLoading || isRecording;


    return (
        <form
            onSubmit={(e) => {
                if (isCurrentlyLoading) { e.preventDefault(); onAbort(); }
                else if (!isRecording) { onSubmit(e); }
                else { e.preventDefault(); } // Prevent form submission if recording
            }}
            className={`flex items-end bg-[var(--color-input-form-bg)] border border-[var(--color-input-form-border)] rounded-xl p-1.5 shadow-lg
                        focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] focus-within:border-[var(--color-focus-ring)]/70
                        transition-all duration-200 ease-in-out
                        ${isRecording ? 'ring-2 !ring-[var(--color-red-500)]/80 !border-[var(--color-red-500)]/80' : ''}
                        ${isTextareaFocused && !isRecording ? '!border-[var(--color-focus-ring)]/70 ring-2 ring-[var(--color-focus-ring)]' : ''}`}
        >
            <div className="flex-shrink-0 p-0.5 flex items-center space-x-0.5">
                {enableWebSearch && (
                    <Button type="button" variant="icon"
                        className={`!p-2.5 rounded-lg transform active:scale-90 transition-colors duration-150 ${isWebSearchEnabledForNextMessage ? 'bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] hover:bg-[var(--color-button-primary-hover-bg)]' : 'text-[var(--color-button-icon-text)] hover:text-[var(--color-button-icon-hover-text)] hover:bg-[var(--color-button-icon-hover-bg)]'}`}
                        onClick={onToggleWebSearch} disabled={isWebSearchButtonDisabled}
                        aria-label={isWebSearchEnabledForNextMessage ? "Desativar busca na web para a próxima mensagem" : "Ativar busca na web para a próxima mensagem"}
                        title={isWebSearchEnabledForNextMessage ? "Busca na web ATIVADA para a próxima mensagem. Clique para desativar." : "Ativar busca na web para a próxima mensagem."}
                    > <IoEarthOutline size={20} /> </Button>
                )}
                {isRecording ? (
                    <Button type="button" variant="danger" className="!p-2.5 text-[var(--color-red-500)] hover:text-[var(--color-red-700)] !bg-[var(--color-red-100)] hover:!bg-[var(--color-red-200)] rounded-lg transform active:scale-90" onClick={onCancelRecording} aria-label="Cancelar gravação" title="Cancelar gravação">
                        <IoClose size={22} />
                    </Button>
                ) : (
                    enableAttachments && (
                        <Button type="button" variant="icon" className="!p-2.5 text-[var(--color-button-icon-text)] hover:text-[var(--color-button-icon-hover-text)] hover:bg-[var(--color-button-icon-hover-bg)] rounded-lg transform active:scale-90" onClick={onAttachClick} disabled={isAttachButtonDisabled} aria-label="Anexar arquivos" title="Anexar arquivos">
                            <IoAttach size={20} />
                        </Button>
                    )
                )}
            </div>
            <input type="file" ref={fileInputRef} multiple onChange={onFileChange} className="hidden" accept="image/*,audio/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/zip,application/x-rar-compressed" disabled={isAttachButtonDisabled || !enableAttachments} />

            <div className="flex-1 mx-1.5 relative flex items-center">
                {isRecording && (
                    <div className="absolute inset-0 flex items-center justify-start pl-3 pointer-events-none z-10">
                        {recordingPlaceholder}
                    </div>
                )}
                <textarea ref={textareaRef} rows={1} value={text} onChange={(e) => onTextChange(e.target.value)}
                    onKeyDown={onKeyDown} onFocus={onTextFocus} onBlur={onTextBlur}
                    placeholder={effectivePlaceholder}
                    className={`w-full bg-transparent text-[var(--color-input-text)] placeholder-[var(--color-input-placeholder)] focus:outline-none py-2.5 resize-none leading-tight transition-all duration-200 ease-in-out ${isRecording ? 'text-transparent caret-transparent' : ''} ${isCurrentlyLoading && !isRecording ? 'placeholder-[var(--color-input-placeholder)]' : ''}`}
                    style={{ maxHeight: isTextareaFocused ? `${window.innerHeight * (FOCUSED_TEXTAREA_MAX_HEIGHT_VH / 100)}px` : `${getPixelValueFromRem(UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM)}px`, minHeight: `${getPixelValueFromRem(UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM)}px` }}
                    disabled={textareaDisabled}
                    aria-label="Campo de entrada de mensagem"
                />
            </div>

            <div className="flex-shrink-0 p-0.5 flex items-center space-x-1.5">
                <Button type="button" variant={isRecording ? "danger" : "icon"}
                    className={`!p-2.5 rounded-lg transform active:scale-90 ${isRecording ? '!bg-[var(--color-button-danger-bg)] hover:!bg-[var(--color-button-danger-hover-bg)] text-[var(--color-button-danger-text)] animate-pulseRing' : 'text-[var(--color-button-icon-text)] hover:text-[var(--color-button-icon-hover-text)] hover:bg-[var(--color-button-icon-hover-bg)]'}`}
                    onClick={onMicButtonClick} disabled={isMicDisabled}
                    aria-label={isRecording ? "Parar gravação e anexar áudio" : "Iniciar gravação de audio"}
                    title={isRecording ? "Parar gravação e anexar áudio" : "Iniciar gravação de áudio"}
                > {isRecording ? <IoStopCircleOutline size={20} /> : <IoMicOutline size={20} />} </Button>
                
                {!isRecording && (
                    <Button type={isCurrentlyLoading ? "button" : "submit"} onClick={isCurrentlyLoading ? onAbort : undefined}
                        variant={isCurrentlyLoading ? "danger" : "primary"}
                        className={`!p-2.5 rounded-lg transform active:scale-90 group overflow-hidden ${isCurrentlyLoading ? 'hover:!bg-[var(--color-button-danger-hover-bg)]' : canSubmitEffectively ? 'hover:!bg-[var(--color-button-primary-hover-bg)]' : '!bg-[var(--color-button-secondary-bg)] !text-[var(--color-button-secondary-text)] cursor-not-allowed'}`}
                        disabled={isCurrentlyLoading ? false : !canSubmitEffectively}
                        aria-label={isCurrentlyLoading ? "Abortar resposta" : "Enviar mensagem"}
                        title={isCurrentlyLoading ? "Abortar resposta" : "Enviar mensagem"}
                    > <span className="block transition-transform duration-200 ease-in-out group-hover:scale-110"> {isCurrentlyLoading ? <IoStop size={20} /> : <IoPaperPlaneOutline size={20} />} </span> </Button>
                )}
            </div>
        </form>
    );
};

export default MessageInputForm;
