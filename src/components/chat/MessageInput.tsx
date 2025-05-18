/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../common/Button';
import {
    IoWarningOutline,
    IoAttach,
    IoMicOutline,
    IoStopCircleOutline,
    IoClose,
    IoStop,
    IoPaperPlaneOutline,
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import {
    streamMessageToGemini,
    type StreamedGeminiResponseChunk,
    type RawFileAttachment
} from '../../services/geminiService';
import type { MessageMetadata, AttachedFileInfo } from '../../types/conversation';
import { v4 as uuidv4 } from 'uuid';
import useIsMobile from '../../hooks/useIsMobile';
import { systemMessage } from '../../prompts';

interface LocalAttachedFile {
    id: string;
    file: File;
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
}

const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

const MessageInput: React.FC = () => {
    const {
        conversations,
        activeConversationId,
        addMessageToConversation,
        updateMessageInConversation,
        isProcessingEditedMessage,
        abortEditedMessageResponse
    } = useConversations();
    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const [text, setText] = useState<string>('');
    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<LocalAttachedFile[]>([]);

    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const wasCancelledRef = useRef<boolean>(false);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const [isTextareaFocused, setIsTextareaFocused] = useState<boolean>(false);

    const isMobile = useIsMobile();
    const abortStreamControllerRef = useRef<AbortController | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM = 2.5;
    const FOCUSED_TEXTAREA_MAX_HEIGHT_VH = 40;
    const MAX_THUMBNAIL_SIZE = 80;

    const getPixelValueFromRem = (rem: number) => {
        if (typeof window !== 'undefined') {
            return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
        }
        return rem * 16;
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

    const placeholderText =
        activeConversationId ?
            (settings.apiKey ? "Digite sua mensagem..." : "Configure sua API Key.") :
            "Crie uma nova conversa.";

    useEffect(() => { adjustTextareaHeight(); }, [text, adjustTextareaHeight]);

    useEffect(() => {
        const handleResize = () => { adjustTextareaHeight(); };
        window.addEventListener('resize', handleResize);
        adjustTextareaHeight();
        return () => { window.removeEventListener('resize', handleResize); };
    }, [adjustTextareaHeight]);

    useEffect(() => {
        if (text !== '' && errorFromAI) { setErrorFromAI(null); }
        if (text !== '' && audioError) { setAudioError(null); }
    }, [text, errorFromAI, audioError]);

    useEffect(() => {
        const currentFiles = [...attachedFiles];
        return () => {
            currentFiles.forEach(f => { if (f.previewUrl) { URL.revokeObjectURL(f.previewUrl); } });
        };
    }, [attachedFiles]);

    const stopMediaStream = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
            stopMediaStream();
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            if (abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
                abortStreamControllerRef.current.abort("Component unmounting");
            }
        };
    }, [stopMediaStream]);

    const addFilesToState = (files: FileList | File[]) => {
        if (isRecording) return;
        const newFiles: LocalAttachedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;
            const fileId = uuidv4();
            const newAttachedFile: LocalAttachedFile = {
                id: fileId,
                file: file,
                name: file.name,
                type: file.type,
                size: file.size,
            };
            if (file.type.startsWith('image/')) {
                newAttachedFile.previewUrl = URL.createObjectURL(file);
            }
            newFiles.push(newAttachedFile);
        }
        setAttachedFiles(prevFiles => [...prevFiles, ...newFiles]);
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;
        addFilesToState(files);
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
        textareaRef.current?.focus();
    };

    const handlePaste = useCallback((event: ClipboardEvent) => {
        if (isRecording || !isTextareaFocused) return;
        const items = event.clipboardData?.items;
        if (items) {
            const filesToPaste: File[] = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    const file = items[i].getAsFile();
                    if (file) { filesToPaste.push(file); }
                }
            }
            if (filesToPaste.length > 0) {
                event.preventDefault();
                addFilesToState(filesToPaste);
            }
        }
    }, [isRecording, isTextareaFocused]);

    useEffect(() => {
        const textareaElement = textareaRef.current;
        if (textareaElement) {
            textareaElement.addEventListener('paste', handlePaste as EventListener);
            return () => { textareaElement.removeEventListener('paste', handlePaste as EventListener); };
        }
    }, [handlePaste]);

    const handleRemoveFile = (fileIdToRemove: string) => {
        setAttachedFiles(prevFiles =>
            prevFiles.filter(f => {
                if (f.id === fileIdToRemove) {
                    if (f.previewUrl) { URL.revokeObjectURL(f.previewUrl); }
                    return false;
                }
                return true;
            })
        );
    };

    const clearAttachmentsFromState = () => {
        attachedFiles.forEach(f => { if (f.previewUrl) { URL.revokeObjectURL(f.previewUrl); } });
        setAttachedFiles([]);
    }

    const startRecording = async () => {
        setAudioError(null);
        setErrorFromAI(null);
        wasCancelledRef.current = false;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setAudioError("Gravação de áudio não é suportada neste navegador.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            const options = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
                ? { mimeType: 'audio/ogg; codecs=opus' }
                : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
                    ? { mimeType: 'audio/webm; codecs=opus' }
                    : {};
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) { audioChunksRef.current.push(event.data); }
            };
            mediaRecorderRef.current.onstop = async () => {
                stopMediaStream();
                setIsRecording(false);
                if (wasCancelledRef.current) {
                    wasCancelledRef.current = false;
                    audioChunksRef.current = [];
                    if (textareaRef.current) textareaRef.current.focus();
                    return;
                }
                if (!mediaRecorderRef.current) return;
                const audioMimeType = mediaRecorderRef.current.mimeType || 'audio/ogg';
                const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeType });
                audioChunksRef.current = [];
                if (audioBlob.size === 0) {
                    setAudioError("Gravação resultou em áudio vazio. Tente novamente.");
                    return;
                }
                await handleSubmit(undefined, audioBlob);
            };
            mediaRecorderRef.current.onerror = (event: Event) => {
                console.error("MediaRecorder error:", event);
                const specificError = (event as any).error;
                setAudioError(`Erro na gravação: ${specificError?.name || specificError?.message || 'Erro desconhecido'}`);
                stopMediaStream();
                setIsRecording(false);
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err: any) {
            console.error("Erro ao acessar microfone:", err);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setAudioError("Permissão para microfone negada. Habilite nas configurações do navegador.");
            } else if (err.name === "NotFoundError") {
                setAudioError("Nenhum dispositivo de áudio encontrado.");
            } else {
                setAudioError("Não foi possível acessar o microfone.");
            }
            setIsRecording(false);
            stopMediaStream();
        }
    };

    const stopRecordingAndSend = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            wasCancelledRef.current = false;
            mediaRecorderRef.current.stop();
        }
    };

    const handleCancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            wasCancelledRef.current = true;
            mediaRecorderRef.current.stop();
        } else {
            stopMediaStream();
            setIsRecording(false);
            audioChunksRef.current = [];
            if (textareaRef.current) textareaRef.current.focus();
        }
        setAudioError(null);
    };

    const handleMicButtonClick = () => {
        if (isRecording) { stopRecordingAndSend(); } else { startRecording(); }
    };

    const handleAbortAIResponse = () => {
        if (isLoadingAI && abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("User aborted direct stream");
            setIsLoadingAI(false);
        } else if (isProcessingEditedMessage) {
            abortEditedMessageResponse();
        }
        if (textareaRef.current) textareaRef.current.focus();
    };

    const handleSubmit = async (e?: React.FormEvent, recordedAudioBlob?: Blob) => {
        if (e) e.preventDefault();
        setErrorFromAI(null);
        if (!isRecording) setAudioError(null);

        const trimmedText = text.trim();
        const hasContentToSend = trimmedText || attachedFiles.length > 0 || recordedAudioBlob;

        if (!hasContentToSend || !activeConversationId || isProcessingEditedMessage) {
            if (isLoadingAI) return;
            if (isRecording && !recordedAudioBlob) return;
            if (!hasContentToSend && activeConversationId && !isProcessingEditedMessage) return;
            return;
        }

        if (!settings.apiKey) {
            addMessageToConversation(activeConversationId, {
                text: "Erro: Chave de API não configurada.", sender: 'ai', metadata: { error: true }
            });
            setText('');
            clearAttachmentsFromState();
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            return;
        }

        if (abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("New submission started");
        }
        abortStreamControllerRef.current = new AbortController();
        const signal = abortStreamControllerRef.current.signal;

        const currentTextForAI = trimmedText;
        const currentConversation = conversations.find(c => c.id === activeConversationId);
        const historyBeforeCurrentUserMessage = currentConversation?.messages.map(msg => ({
            sender: msg.sender, text: msg.text
        })) || [];

        const filesInfoForUIMessagePromises: Promise<AttachedFileInfo>[] = attachedFiles.map(localFile =>
            blobToDataURL(localFile.file).then(dataUrl => ({
                id: localFile.id, name: localFile.name, type: localFile.type, size: localFile.size, dataUrl: dataUrl,
            })).catch(err => {
                console.error(`Falha ao converter ${localFile.name} para Data URL:`, err);
                return {
                    id: localFile.id, name: localFile.name, type: localFile.type, size: localFile.size, dataUrl: localFile.previewUrl
                };
            })
        );

        if (recordedAudioBlob) {
            const audioId = uuidv4();
            const audioMimeTypeForUI = recordedAudioBlob.type || 'audio/ogg';
            const audioExtension = audioMimeTypeForUI.split('/')[1] || 'ogg';
            const audioFileNameForUI = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${audioExtension}`;
            filesInfoForUIMessagePromises.push(
                blobToDataURL(recordedAudioBlob).then(dataUrl => ({
                    id: audioId, name: audioFileNameForUI, type: audioMimeTypeForUI, size: recordedAudioBlob.size, dataUrl: dataUrl,
                })).catch(err => {
                    console.error(`Falha ao converter áudio gravado para Data URL:`, err);
                    return { id: audioId, name: audioFileNameForUI, type: audioMimeTypeForUI, size: recordedAudioBlob.size, dataUrl: undefined };
                })
            );
        }
        const resolvedFilesInfoForUIMessage = await Promise.all(filesInfoForUIMessagePromises);

        addMessageToConversation(activeConversationId, {
            text: trimmedText,
            sender: 'user',
            metadata: {
                attachedFilesInfo: resolvedFilesInfoForUIMessage.length > 0 ? resolvedFilesInfoForUIMessage : undefined
            }
        });

        setText('');
        setIsLoadingAI(true);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }

        const aiMessageId = addMessageToConversation(activeConversationId, {
            text: "", sender: 'ai', metadata: { isLoading: true }
        });
        if (!aiMessageId) {
            console.error("Não foi possível criar a mensagem placeholder da IA.");
            setIsLoadingAI(false);
            clearAttachmentsFromState();
            return;
        }

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;
        let accumulatedAiText = "";

        try {
            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));

            const rawFilesForAPI: RawFileAttachment[] = [];
            for (const localFile of attachedFiles) {
                rawFilesForAPI.push({ file: localFile.file });
            }

            if (recordedAudioBlob) {
                const audioMimeTypeForFile = recordedAudioBlob.type || 'audio/ogg';
                const audioExtensionForFile = audioMimeTypeForFile.split('/')[1] || 'ogg';
                const audioFileNameForFile = `recorded_audio_${Date.now()}.${audioExtensionForFile}`;
                const audioFileForAPI = new File([recordedAudioBlob], audioFileNameForFile, { type: audioMimeTypeForFile });
                rawFilesForAPI.push({ file: audioFileForAPI });
            }

            const systemInstructionText = systemMessage({
                conversationTitle: currentConversation?.title,
                messageCountInConversation: currentConversation?.messages.length,
                customPersonalityPrompt: settings.customPersonalityPrompt
            });

            clearAttachmentsFromState();

            const streamGenerator = streamMessageToGemini(
                settings.apiKey,
                historyBeforeCurrentUserMessage,
                currentTextForAI,
                rawFilesForAPI,
                currentGlobalMemoriesWithObjects,
                settings.geminiModelConfig,
                systemInstructionText,
                signal
            );

            for await (const streamResponse of streamGenerator) {
                if (signal.aborted) {
                    streamError = "Resposta abortada pelo usuário.";
                    break;
                }
                if (streamResponse.delta) {
                    const isStatusMessage = streamResponse.delta.startsWith("Processando anexos...") ||
                        streamResponse.delta.startsWith("Anexos processados") ||
                        streamResponse.delta.startsWith("Alguns anexos processados") ||
                        streamResponse.delta.startsWith("Falha ao processar anexos");

                    if (isStatusMessage) {
                        updateMessageInConversation(activeConversationId, aiMessageId, {
                            text: accumulatedAiText + streamResponse.delta, // Adiciona status ao texto existente
                            metadata: { isLoading: true }
                        });
                    } else {
                        accumulatedAiText += streamResponse.delta;
                        updateMessageInConversation(activeConversationId, aiMessageId, {
                            text: accumulatedAiText + "▍",
                            metadata: { isLoading: true }
                        });
                    }
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    if (!streamResponse.delta) {
                        setErrorFromAI(streamError);
                    } else {
                        console.warn("Erro parcial durante o stream (anexo?):", streamError);
                        updateMessageInConversation(activeConversationId, aiMessageId, {
                            text: accumulatedAiText + `\n\n⚠️ ${streamError}`,
                            metadata: { isLoading: true }
                        });
                    }
                    if (streamResponse.isFinished) break;
                }
                if (streamResponse.isFinished) {
                    accumulatedAiText = streamResponse.finalText || accumulatedAiText;
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }

            const finalMetadata: Partial<MessageMetadata> = {
                isLoading: false,
                abortedByUser: streamError === "Resposta abortada pelo usuário." || streamError?.includes("abortado") ? true : undefined,
            };

            if (streamError && !finalMetadata.abortedByUser) {
                finalMetadata.error = streamError;
                finalMetadata.userFacingError = streamError;
            }

            if (!streamError || finalMetadata.abortedByUser || accumulatedAiText) {
                const processedMemoryActions: Required<MessageMetadata>['memorizedMemoryActions'] = [];
                if (memoryOperationsFromServer && memoryOperationsFromServer.length > 0 && !streamError) {
                    memoryOperationsFromServer.forEach(op => {
                        if (op.action === 'create' && op.content) {
                            const newMemoryObject = addMemory(op.content);
                            if (newMemoryObject) {
                                processedMemoryActions.push({ id: newMemoryObject.id, content: newMemoryObject.content, action: 'created' });
                            }
                        } else if (op.action === 'update' && op.targetMemoryContent && op.content) {
                            const memoryToUpdate = globalMemoriesFromHook.find(mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase());
                            if (memoryToUpdate) {
                                updateMemory(memoryToUpdate.id, op.content);
                                processedMemoryActions.push({ id: memoryToUpdate.id, content: op.content, originalContent: memoryToUpdate.content, action: 'updated' });
                            } else {
                                const newMemoryObject = addMemory(op.content);
                                if (newMemoryObject) {
                                    processedMemoryActions.push({ id: newMemoryObject.id, content: newMemoryObject.content, action: 'created' });
                                }
                            }
                        } else if (op.action === 'delete_by_ai_suggestion' && op.targetMemoryContent) {
                            const memoryToDelete = globalMemoriesFromHook.find(mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase());
                            if (memoryToDelete) {
                                deleteMemoryFromHook(memoryToDelete.id);
                                processedMemoryActions.push({ id: memoryToDelete.id, content: memoryToDelete.content, originalContent: memoryToDelete.content, action: 'deleted_by_ai' });
                            }
                        }
                    });
                    if (processedMemoryActions.length > 0) {
                        finalMetadata.memorizedMemoryActions = processedMemoryActions;
                    }
                }
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: accumulatedAiText.replace(/▍$/, '').replace(/\n\n⚠️ .+$/, ''), // Remove o cursor e erros parciais se houver texto final
                    metadata: finalMetadata
                });
            } else if (streamError) { // Erro ocorreu e não há texto acumulado para mostrar
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: "",
                    metadata: finalMetadata
                });
            }

        } catch (error: unknown) {
            console.error("Falha catastrófica ao processar stream com Gemini:", error);
            if ((error as Error).name === 'AbortError' || signal.aborted) {
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: accumulatedAiText.replace(/▍$/, ''),
                    metadata: { isLoading: false, error: false, abortedByUser: true }
                });
            } else {
                const clientErrorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu uma falha desconhecida no processamento da resposta.";
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: "",
                    metadata: { isLoading: false, error: clientErrorMessage, userFacingError: clientErrorMessage }
                });
                setErrorFromAI(clientErrorMessage);
            }
        } finally {
            setIsLoadingAI(false);
            if (abortStreamControllerRef.current && abortStreamControllerRef.current.signal === signal) {
                abortStreamControllerRef.current = null;
            }
            if (textareaRef.current && settings.apiKey && !streamError && !errorFromAI && !isProcessingEditedMessage && !isRecording) {
                textareaRef.current.focus();
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isProcessingEditedMessage || isRecording) {
            if (e.key === 'Enter') e.preventDefault();
            return;
        }
        const currentIsLoading = isLoadingAI || isProcessingEditedMessage;
        if (currentIsLoading) {
            if (e.key === 'Enter') { e.preventDefault(); }
            return;
        }
        const hasContent = text.trim().length > 0 || attachedFiles.length > 0;
        if (isMobile) {
            if (e.key === 'Enter' && e.ctrlKey && hasContent) {
                e.preventDefault(); handleSubmit();
            }
        } else {
            if (e.key === 'Enter' && !e.shiftKey && hasContent) {
                e.preventDefault(); handleSubmit();
            }
        }
    };

    const isCurrentlyLoading = isLoadingAI || isProcessingEditedMessage;
    const canSubmitEffectively = (text.trim().length > 0 || attachedFiles.length > 0) && !!activeConversationId && !isCurrentlyLoading && !!settings.apiKey && !isRecording;
    const isTextareaAndAttachDisabled = !activeConversationId || !settings.apiKey || isProcessingEditedMessage || isRecording;
    const isMicDisabled = !activeConversationId || !settings.apiKey || isProcessingEditedMessage || isLoadingAI;

    const recordingPlaceholder = (
        <div className="flex items-center text-sm text-slate-400">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 animate-ping opacity-75"></span>
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 absolute top-1/2 left-3 -translate-y-1/2"></span>
            Gravando áudio...
        </div>
    );

    return (
        <div className="px-2 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 border-t border-slate-700/60 bg-slate-800/95 backdrop-blur-sm sticky bottom-0 shadow- ऊपर-md z-20">
            {errorFromAI && (
                <div className="mb-2 p-2 text-xs text-red-400 bg-red-900/40 border border-red-700/50 rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0 text-base" />
                    <span>{errorFromAI}</span>
                </div>
            )}
            {audioError && (
                <div className="mb-2 p-2 text-xs text-yellow-500 bg-yellow-900/40 border border-yellow-700/50 rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0 text-base" />
                    <span>{audioError}</span>
                </div>
            )}

            {attachedFiles.length > 0 && !isRecording && (
                <div className="mb-2 p-2 bg-slate-800 border border-slate-700/80 rounded-lg flex flex-wrap gap-2.5 items-start max-h-44 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50 shadow-sm">
                    {attachedFiles.map(item => (
                        <div key={item.id} className="relative group bg-slate-700/80 p-1.5 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200">
                            {item.previewUrl && item.type.startsWith('image/') ? (
                                <img
                                    src={item.previewUrl}
                                    alt={`Preview ${item.name}`}
                                    className="object-cover rounded-sm"
                                    style={{ width: `${MAX_THUMBNAIL_SIZE}px`, height: `${MAX_THUMBNAIL_SIZE}px` }}
                                />
                            ) : (
                                <div
                                    className="flex items-center justify-center bg-slate-600/70 text-slate-300 rounded-sm text-[11px] p-2 break-all"
                                    style={{ width: `${MAX_THUMBNAIL_SIZE}px`, height: `${MAX_THUMBNAIL_SIZE}px`, overflow: 'hidden' }}
                                    title={item.name}
                                >
                                    <span className='truncate'>{item.name}</span>
                                </div>
                            )}
                            <Button
                                variant="icon"
                                className="!absolute -top-2 -right-2 !p-1 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out transform group-hover:scale-110 focus:opacity-100 focus:scale-110"
                                onClick={() => handleRemoveFile(item.id)}
                                aria-label={`Remover ${item.name}`}
                                title={`Remover ${item.name}`}
                            >
                                <IoClose size={16} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <form
                onSubmit={(e) => {
                    if (isCurrentlyLoading) { e.preventDefault(); handleAbortAIResponse(); }
                    else { handleSubmit(e); }
                }}
                className={`flex items-end bg-slate-900/90 border border-slate-700/70 rounded-xl p-1.5 shadow-lg
                            focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500/70
                            transition-all duration-200 ease-in-out
                            ${isRecording ? 'ring-2 !ring-red-500/80 !border-red-500/80' : ''}
                            ${isTextareaFocused ? '!border-blue-500/70 ring-2 ring-blue-500' : ''}`}
            >
                <div className="flex-shrink-0 p-0.5">
                    {isRecording ? (
                        <Button type="button" variant="icon"
                            className="!p-2.5 text-red-400 hover:text-red-300 !bg-red-900/50 hover:!bg-red-800/60 rounded-lg transform active:scale-90"
                            onClick={handleCancelRecording} aria-label="Cancelar gravação" title="Cancelar gravação"
                        ><IoClose size={22} /></Button>
                    ) : (
                        <Button type="button" variant="icon"
                            className="!p-2.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 rounded-lg transform active:scale-90"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isTextareaAndAttachDisabled || isLoadingAI}
                            aria-label="Anexar arquivos" title="Anexar arquivos"
                        ><IoAttach size={20} /></Button>
                    )}
                </div>
                <input
                    type="file" ref={fileInputRef} multiple onChange={handleFileChange} className="hidden"
                    accept="image/*,audio/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/zip,application/x-rar-compressed"
                    disabled={isTextareaAndAttachDisabled || isLoadingAI}
                />
                <div className="flex-1 mx-1.5 relative flex items-center">
                    {isRecording && (
                        <div className="absolute inset-0 flex items-center justify-start px-3 pointer-events-none z-10">
                            {recordingPlaceholder}
                        </div>
                    )}
                    <textarea
                        ref={textareaRef} rows={1} value={text} onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown} onFocus={() => setIsTextareaFocused(true)} onBlur={() => setIsTextareaFocused(false)}
                        placeholder={isRecording ? '' : (isCurrentlyLoading ? 'IA respondendo...' : placeholderText)}
                        className={`w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none py-2.5 resize-none leading-tight
                                    scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent
                                    transition-all duration-200 ease-in-out
                                    ${isRecording ? 'text-transparent caret-transparent' : ''}
                                    ${isCurrentlyLoading ? 'placeholder-slate-600' : ''}`}
                        style={{
                            maxHeight: isTextareaFocused ? `${window.innerHeight * (FOCUSED_TEXTAREA_MAX_HEIGHT_VH / 100)}px` : `${getPixelValueFromRem(UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM)}px`,
                            minHeight: `${getPixelValueFromRem(UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM)}px`
                        }}
                        disabled={isTextareaAndAttachDisabled && !isLoadingAI && !isProcessingEditedMessage}
                        aria-label="Campo de entrada de mensagem"
                    />
                </div>
                <div className="flex-shrink-0 p-0.5 flex items-center space-x-1.5">
                    <Button
                        type="button" variant={isRecording ? "danger" : "icon"}
                        className={`!p-2.5 rounded-lg transform active:scale-90
                                    ${isRecording ? '!bg-red-600 hover:!bg-red-700 text-white animate-pulseRing'
                                : 'text-slate-400 hover:text-blue-400 hover:bg-slate-700/60'}`}
                        onClick={handleMicButtonClick} disabled={isMicDisabled || isProcessingEditedMessage}
                        aria-label={isRecording ? "Parar gravação e enviar" : "Iniciar gravação de áudio"}
                        title={isRecording ? "Parar gravação e enviar" : "Iniciar gravação de áudio"}
                    >
                        {isRecording ? <IoStopCircleOutline size={20} /> : <IoMicOutline size={20} />}
                    </Button>
                    {(!isRecording) && (
                        <Button
                            type={isCurrentlyLoading ? "button" : "submit"}
                            onClick={isCurrentlyLoading ? handleAbortAIResponse : undefined}
                            variant={isCurrentlyLoading ? "danger" : "primary"}
                            className={`!p-2.5 rounded-lg transform active:scale-90 group overflow-hidden
                                        ${isCurrentlyLoading ? 'hover:!bg-red-700'
                                    : canSubmitEffectively ? 'hover:!bg-blue-700'
                                        : '!bg-slate-700 !text-slate-500 cursor-not-allowed'}`}
                            disabled={isCurrentlyLoading ? false : !canSubmitEffectively}
                            aria-label={isCurrentlyLoading ? "Abortar resposta" : "Enviar mensagem"}
                            title={isCurrentlyLoading ? "Abortar resposta" : "Enviar mensagem"}
                        >
                            <span className="block transition-transform duration-200 ease-in-out group-hover:scale-110">
                                {isCurrentlyLoading ? <IoStop size={20} /> : <IoPaperPlaneOutline size={20} />}
                            </span>
                        </Button>
                    )}
                </div>
            </form>
            {!settings.apiKey && activeConversationId && !isCurrentlyLoading && !isRecording && (
                <p className="text-xs text-yellow-400/90 text-center mt-2.5 px-2">
                    Chave de API não configurada. Por favor, adicione sua chave nas <strong className="font-medium text-yellow-300">Configurações</strong> para interagir com a IA.
                </p>
            )}
        </div>
    );
};

export default MessageInput;
