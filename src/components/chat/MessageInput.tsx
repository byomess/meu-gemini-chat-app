/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/input/MessageInput.tsx
import React, { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import Button from '../common/Button';
import {
    IoWarningOutline,
    IoAttach,
    IoMicOutline,
    IoStopCircleOutline,
    IoClose,
    IoStop,
    IoPaperPlaneOutline,
    IoEarthOutline,
    IoVideocamOutline,
    IoImageOutline,
    IoDocumentTextOutline,
} from 'react-icons/io5';
import { Dialog, Transition } from '@headlessui/react';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import {
    streamMessageToGemini,
    type StreamedGeminiResponseChunk,
    type RawFileAttachment
} from '../../services/geminiService';
import type { MessageMetadata, AttachedFileInfo, ProcessingStatus, Part } from '../../types'; // Adicionado ProcessingStatus, Part
import { v4 as uuidv4 } from 'uuid';
import useIsMobile from '../../hooks/useIsMobile';
import { systemMessage } from '../../prompts';
// Removido: import type { Part } from '@google/genai'; // Já vem de ../../types
import CustomAudioPlayer from '../common/CustomAudioPlayer';

interface LocalAttachedFile {
    id: string;
    file: File;
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
    isRecording?: boolean;
}

interface MediaModalProps {
    isOpen: boolean;
    onClose: () => void;
    mediaUrl?: string;
    mediaName?: string;
    mediaType?: string;
}

const MediaModal: React.FC<MediaModalProps> = ({ isOpen, onClose, mediaUrl, mediaName, mediaType }) => {
    if (!mediaUrl) return null;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[150]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-transparent p-0 text-left align-middle shadow-xl transition-all">
                                {mediaType?.startsWith('image/') && (
                                    <img
                                        src={mediaUrl}
                                        alt={mediaName || 'Imagem Ampliada'}
                                        className="max-h-[90vh] max-w-full mx-auto object-contain rounded-md"
                                    />
                                )}
                                {mediaType?.startsWith('video/') && (
                                    <video
                                        src={mediaUrl}
                                        controls
                                        autoPlay
                                        className="max-h-[90vh] max-w-full mx-auto object-contain rounded-md"
                                        title={mediaName || 'Vídeo Ampliado'}
                                    />
                                )}
                                <Button
                                    variant="icon"
                                    onClick={onClose}
                                    className="!absolute top-2 right-2 !p-2.5 text-white bg-black/50 hover:!bg-black/70 rounded-full z-10"
                                    title="Fechar mídia"
                                >
                                    <IoClose size={24} />
                                </Button>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};


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
    const [isWebSearchEnabledForNextMessage, setIsWebSearchEnabledForNextMessage] = useState<boolean>(false);

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

    const [mediaModalOpenInput, setMediaModalOpenInput] = useState(false);
    const [selectedMediaInput, setSelectedMediaInput] = useState<LocalAttachedFile | null>(null);

    // Refs para armazenar o último status de processamento e raw parts durante o stream de uma nova mensagem
    const lastProcessingStatusForInputRef = useRef<ProcessingStatus | null>(null);
    const accumulatedRawPartsForInputRef = useRef<Part[]>([]);


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


    const UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM = 2.5; // Approx 40px for 16px base
    const FOCUSED_TEXTAREA_MAX_HEIGHT_VH = 40;
    const MAX_THUMBNAIL_SIZE = 80; // pixels

    const getPixelValueFromRem = (rem: number) => {
        if (typeof window !== 'undefined') {
            return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
        }
        return rem * 16; // Fallback for SSR or tests
    };

    const adjustTextareaHeight = useCallback(() => {
        if (textareaRef.current) {
            const currentTextarea = textareaRef.current;
            currentTextarea.style.height = 'auto'; // Reset height to shrink if needed
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
            (settings.apiKey ? "Digite a mensagem..." : "Configure sua API Key.") :
            "Crie uma nova conversa.";

    useEffect(() => { adjustTextareaHeight(); }, [text, adjustTextareaHeight]);

    useEffect(() => {
        const handleResize = () => { adjustTextareaHeight(); };
        window.addEventListener('resize', handleResize);
        adjustTextareaHeight(); // Initial adjustment
        return () => { window.removeEventListener('resize', handleResize); };
    }, [adjustTextareaHeight]);

    useEffect(() => {
        if (text !== '' && errorFromAI) { setErrorFromAI(null); }
        if (text !== '' && audioError) { setAudioError(null); }
    }, [text, errorFromAI, audioError]);

    useEffect(() => {
        const currentFiles = [...attachedFiles];
        return () => {
            currentFiles.forEach(f => { if (f.previewUrl && f.previewUrl.startsWith('blob:')) { URL.revokeObjectURL(f.previewUrl); } });
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

    const addFilesToState = async (files: FileList | File[], isRecordedAudio = false) => {
        // Allow adding recorded audio even if general attachments are off
        if (!settings.enableAttachments && !isRecordedAudio) return;
        if (isRecording && !isRecordedAudio) return;

        const newFilesPromises: Promise<LocalAttachedFile | null>[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;

            const fileId = uuidv4();
            const newAttachedFilePromise: Promise<LocalAttachedFile | null> = (async () => {
                let previewUrl: string | undefined = undefined;
                if (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                    try {
                        previewUrl = await blobToDataURL(file);
                    } catch (e) {
                        console.error(`Error creating data URL for ${file.name}:`, e);
                        if (file.type.startsWith('image/')) { // Fallback for images if dataURL fails
                            try { previewUrl = URL.createObjectURL(file); } catch (e2) { console.error("Error creating ObjectURL for image preview:", e2); }
                        }
                    }
                }

                return {
                    id: fileId,
                    file: file,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    previewUrl: previewUrl,
                    isRecording: isRecordedAudio ? false : undefined, // Mark as not a live recording if it's processed audio
                };
            })();
            newFilesPromises.push(newAttachedFilePromise);
        }

        const newFilesResolved = (await Promise.all(newFilesPromises)).filter(f => f !== null) as LocalAttachedFile[];
        setAttachedFiles(prevFiles => [...prevFiles, ...newFilesResolved]);
    }


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!settings.enableAttachments) return;
        const files = event.target.files;
        if (!files) return;
        addFilesToState(files);
        if (fileInputRef.current) { fileInputRef.current.value = ""; } // Reset file input
        textareaRef.current?.focus();
    };

    const handlePaste = useCallback(async (event: ClipboardEvent) => {
        if (!settings.enableAttachments || isRecording || !isTextareaFocused) return;
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
                await addFilesToState(filesToPaste);
            }
        }
    }, [isRecording, isTextareaFocused, addFilesToState, settings.enableAttachments]);

    useEffect(() => {
        const textareaElement = textareaRef.current;
        if (textareaElement && settings.enableAttachments) {
            textareaElement.addEventListener('paste', handlePaste as unknown as EventListener);
            return () => { textareaElement.removeEventListener('paste', handlePaste as unknown as EventListener); };
        }
    }, [handlePaste, settings.enableAttachments]);

    const handleRemoveFile = (fileIdToRemove: string) => {
        setAttachedFiles(prevFiles =>
            prevFiles.filter(f => {
                if (f.id === fileIdToRemove) {
                    if (f.previewUrl && f.previewUrl.startsWith('blob:')) { // Only revoke ObjectURLs
                        URL.revokeObjectURL(f.previewUrl);
                    }
                    return false;
                }
                return true;
            })
        );
    };

    const clearAttachmentsFromState = () => {
        attachedFiles.forEach(f => {
            if (f.previewUrl && f.previewUrl.startsWith('blob:')) { // Only revoke ObjectURLs
                URL.revokeObjectURL(f.previewUrl);
            }
        });
        setAttachedFiles([]);
    }

    const startRecording = async () => {
        // Audio recording can be independent of general file attachments
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
                    : MediaRecorder.isTypeSupported('audio/mp4')
                        ? { mimeType: 'audio/mp4' }
                        : {}; // Let the browser decide if none are explicitly supported
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) { audioChunksRef.current.push(event.data); }
            };

            mediaRecorderRef.current.onstop = async () => {
                stopMediaStream(); // Stop the tracks once recording is done
                setIsRecording(false);
                if (wasCancelledRef.current) {
                    wasCancelledRef.current = false;
                    audioChunksRef.current = []; // Clear chunks if cancelled
                    if (textareaRef.current) textareaRef.current.focus();
                    return;
                }
                if (!mediaRecorderRef.current) return; // Should not happen if onstop is called

                const audioMimeType = mediaRecorderRef.current.mimeType || 'audio/ogg'; // Fallback mime type
                const audioBlob = new Blob(audioChunksRef.current, { type: audioMimeType });
                audioChunksRef.current = []; // Clear chunks after creating blob

                if (audioBlob.size === 0) {
                    setAudioError("Gravação resultou em áudio vazio. Tente novamente.");
                    if (textareaRef.current) textareaRef.current.focus();
                    return;
                }

                const audioExtension = audioMimeType.split('/')[1]?.split(';')[0] || 'ogg';
                const audioFileName = `gravacao_${Date.now()}.${audioExtension}`;
                const recordedAudioFile = new File([audioBlob], audioFileName, { type: audioMimeType });

                await addFilesToState([recordedAudioFile], true); // Mark as recorded audio

                if (textareaRef.current) textareaRef.current.focus();
            };

            mediaRecorderRef.current.onerror = (event: Event) => {
                console.error("MediaRecorder error:", event);
                const specificError = (event as any).error; // Type assertion for specific error
                setAudioError(`Erro na gravação: ${specificError?.name || specificError?.message || 'Erro desconhecido'}`);
                stopMediaStream();
                setIsRecording(false);
                if (textareaRef.current) textareaRef.current.focus();
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
            stopMediaStream(); // Ensure stream is stopped on error
        }
    };

    const stopRecordingAndAttach = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            wasCancelledRef.current = false; // Ensure it's not treated as a cancellation
            mediaRecorderRef.current.stop();
            // onstop will handle the rest
        }
    };

    const handleCancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            wasCancelledRef.current = true; // Mark as cancelled
            mediaRecorderRef.current.stop();
            // onstop will handle cleanup
        } else {
            // If not actively recording but mic might be on (e.g., permission granted but error before start)
            stopMediaStream();
            setIsRecording(false);
            audioChunksRef.current = []; // Clear any stray chunks
        }
        setAudioError(null); // Clear any previous audio error
        if (textareaRef.current) textareaRef.current.focus();
    };

    const handleMicButtonClick = () => {
        // Mic button logic is independent of settings.enableAttachments for its own operation
        if (isRecording) {
            stopRecordingAndAttach();
        } else {
            startRecording();
        }
    };

    const handleAbortAIResponse = () => {
        if (isLoadingAI && abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("User aborted direct stream");
        } else if (isProcessingEditedMessage) {
            abortEditedMessageResponse();
        }
        if (textareaRef.current) textareaRef.current.focus();
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorFromAI(null);

        const trimmedText = text.trim();
        // Content to send can be text OR (if attachments enabled OR if it's recorded audio) attached files
        const hasFilesToSend = (settings.enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) && attachedFiles.length > 0;
        const hasContentToSend = trimmedText || hasFilesToSend;


        if (!hasContentToSend || !activeConversationId || isProcessingEditedMessage || isRecording) {
            if (isLoadingAI) return; // Don't submit if AI is already loading (unless it's an abort action)
            return;
        }

        if (!settings.apiKey) {
            addMessageToConversation(activeConversationId, {
                text: "Erro: Chave de API não configurada.", sender: 'model', metadata: { error: true }
            });
            setText('');
            clearAttachmentsFromState(); // Clear all attachments regardless of type
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            return;
        }

        if (abortStreamControllerRef.current && !abortStreamControllerRef.current.signal.aborted) {
            abortStreamControllerRef.current.abort("New submission started");
        }
        abortStreamControllerRef.current = new AbortController();
        const signal = abortStreamControllerRef.current.signal;

        lastProcessingStatusForInputRef.current = null;
        accumulatedRawPartsForInputRef.current = [];
        let accumulatedAiText = "";

        const currentTextForAI = trimmedText;
        const currentConversation = conversations.find(c => c.id === activeConversationId);
        const webSearchActiveForThisSubmission = settings.enableWebSearch && isWebSearchEnabledForNextMessage;
        if (isWebSearchEnabledForNextMessage) setIsWebSearchEnabledForNextMessage(false);

        const historyBeforeCurrentUserMessage: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[] =
            currentConversation?.messages.map(msg => {
                if (msg.metadata?.rawParts) {
                    return { sender: msg.sender, parts: msg.metadata.rawParts as Part[] };
                }
                return { sender: msg.sender, text: msg.text };
            }) || [];

        // Files for UI message can be all types if attachments are enabled, or only audio if not
        const filesInfoForUIMessage: AttachedFileInfo[] = attachedFiles
            .filter(localFile => settings.enableAttachments || localFile.file.type.startsWith('audio/'))
            .map(localFile => ({
                id: localFile.id,
                name: localFile.name,
                type: localFile.type,
                size: localFile.size,
                dataUrl: localFile.previewUrl,
            }));


        addMessageToConversation(activeConversationId, {
            text: trimmedText,
            sender: 'user',
            metadata: {
                attachedFilesInfo: filesInfoForUIMessage.length > 0 ? filesInfoForUIMessage : undefined
            }
        });

        // Files to send to AI can be all types if attachments are enabled, or only audio if not
        const filesToSendToAI = attachedFiles.filter(localFile => settings.enableAttachments || localFile.file.type.startsWith('audio/'));
        setText('');
        clearAttachmentsFromState(); // Clear all attachments
        setIsLoadingAI(true);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }

        const aiMessageId = addMessageToConversation(activeConversationId, {
            text: "", sender: 'model', metadata: { isLoading: true }
        });
        if (!aiMessageId) {
            console.error("Não foi possível criar a mensagem placeholder da IA.");
            setIsLoadingAI(false);
            return;
        }

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;

        try {
            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));
            const rawFilesForAPI: RawFileAttachment[] = filesToSendToAI.map(localFile => ({ file: localFile.file }));
            const systemInstructionText = systemMessage({
                conversationTitle: currentConversation?.title,
                messageCountInConversation: currentConversation?.messages.length,
                customPersonalityPrompt: settings.customPersonalityPrompt
            });

            const streamGenerator = streamMessageToGemini(
                settings.apiKey, historyBeforeCurrentUserMessage, currentTextForAI, rawFilesForAPI,
                currentGlobalMemoriesWithObjects, settings.geminiModelConfig, systemInstructionText,
                settings.functionDeclarations || [], signal,
                webSearchActiveForThisSubmission
            );

            for await (const streamResponse of streamGenerator) {
                if (signal.aborted) { streamError = "Resposta abortada pelo usuário."; break; }

                if (streamResponse.delta) {
                    accumulatedAiText += streamResponse.delta;
                }
                if (streamResponse.processingStatus) {
                    lastProcessingStatusForInputRef.current = streamResponse.processingStatus;
                }
                if (streamResponse.rawPartsForNextTurn) {
                    accumulatedRawPartsForInputRef.current = [...streamResponse.rawPartsForNextTurn];
                }

                const showTypingCursor = !streamResponse.isFinished &&
                    !(lastProcessingStatusForInputRef.current &&
                        (lastProcessingStatusForInputRef.current.stage === 'pending' ||
                            lastProcessingStatusForInputRef.current.stage === 'in_progress' ||
                            lastProcessingStatusForInputRef.current.stage === 'awaiting_ai'));

                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: accumulatedAiText + (showTypingCursor ? "▍" : ""),
                    metadata: {
                        isLoading: !streamResponse.isFinished,
                        processingStatus: lastProcessingStatusForInputRef.current || undefined,
                        rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
                    }
                });

                if (streamResponse.error) {
                    streamError = streamResponse.error;
                }
                if (streamResponse.isFinished) {
                    accumulatedAiText = streamResponse.finalText || accumulatedAiText.replace(/▍$/, '');
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }

            const finalMetadata: Partial<MessageMetadata> = {
                isLoading: false,
                abortedByUser: streamError === "Resposta abortada pelo usuário." || (signal.aborted && !streamError) ? true : undefined,
                processingStatus: lastProcessingStatusForInputRef.current || undefined,
                rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
            };

            if (streamError && !finalMetadata.abortedByUser) {
                finalMetadata.error = streamError;
                finalMetadata.userFacingError = streamError;
                if (lastProcessingStatusForInputRef.current && lastProcessingStatusForInputRef.current.stage !== 'completed' && lastProcessingStatusForInputRef.current.stage !== 'failed') {
                    finalMetadata.processingStatus = { ...(lastProcessingStatusForInputRef.current || {} as ProcessingStatus), stage: 'failed', error: streamError };
                }
            }

            if (!streamError || finalMetadata.abortedByUser) {
                const processedMemoryActions: Required<MessageMetadata>['memorizedMemoryActions'] = [];
                if (memoryOperationsFromServer && memoryOperationsFromServer.length > 0) {
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
            }

            const finalDisplayableText = accumulatedAiText;
            updateMessageInConversation(activeConversationId, aiMessageId, {
                text: finalDisplayableText, metadata: finalMetadata
            });

        } catch (error: unknown) {
            console.error("Falha catastrófica ao processar stream com Gemini:", error);
            const finalMetadataUpdate: Partial<MessageMetadata> = {
                isLoading: false,
                processingStatus: lastProcessingStatusForInputRef.current || undefined,
                rawParts: accumulatedRawPartsForInputRef.current.length > 0 ? [...accumulatedRawPartsForInputRef.current] : undefined,
            };
            if ((error as Error).name === 'AbortError' || signal.aborted) {
                finalMetadataUpdate.abortedByUser = true; finalMetadataUpdate.error = false;
            } else {
                const clientErrorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu uma falha desconhecida no processamento da resposta.";
                finalMetadataUpdate.error = clientErrorMessage;
                finalMetadataUpdate.userFacingError = clientErrorMessage;
                setErrorFromAI(clientErrorMessage);
            }
            updateMessageInConversation(activeConversationId, aiMessageId, {
                text: accumulatedAiText.replace(/▍$/, ''), metadata: finalMetadataUpdate
            });
        } finally {
            setIsLoadingAI(false);
            if (abortStreamControllerRef.current && abortStreamControllerRef.current.signal === signal) {
                abortStreamControllerRef.current = null;
            }
            lastProcessingStatusForInputRef.current = null;
            accumulatedRawPartsForInputRef.current = [];

            if (textareaRef.current && settings.apiKey && !errorFromAI && !streamError && !isProcessingEditedMessage && !isRecording && !isLoadingAI) {
                if (document.contains(textareaRef.current)) {
                    textareaRef.current.focus();
                }
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isRecording || isProcessingEditedMessage || isLoadingAI) {
            if (e.key === 'Enter') e.preventDefault();
            return;
        }
        const hasTextContent = text.trim().length > 0;
        const hasFiles = (settings.enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) && attachedFiles.length > 0;
        const hasContent = hasTextContent || hasFiles;

        if (isMobile ? (e.key === 'Enter' && e.ctrlKey && hasContent) : (e.key === 'Enter' && !e.shiftKey && hasContent)) {
            e.preventDefault(); handleSubmit();
        }
    };

    const isCurrentlyLoading = isLoadingAI || isProcessingEditedMessage;
    const canSubmitEffectively = (text.trim().length > 0 || ((settings.enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) && attachedFiles.length > 0)) && !!activeConversationId && !isCurrentlyLoading && !!settings.apiKey && !isRecording;
    const isAttachButtonDisabled = !activeConversationId || !settings.apiKey || isProcessingEditedMessage || isRecording || isLoadingAI || !settings.enableAttachments;
    const isMicDisabled = !activeConversationId || !settings.apiKey || isProcessingEditedMessage || isLoadingAI; // Removed !settings.enableAttachments
    const isWebSearchButtonDisabled = !activeConversationId || !settings.apiKey || isCurrentlyLoading || isRecording;

    const recordingPlaceholder = (
        <div className="flex items-center text-sm text-gray-500">
            <div className="relative w-3 h-3 mr-2 flex items-center justify-center">
                <span className="absolute inline-flex w-2 h-2 bg-red-500 rounded-full opacity-75 animate-ping"></span>
                <span className="relative inline-block w-2 h-2 bg-red-500 rounded-full"></span>
            </div>
            <span className="whitespace-nowrap">Gravando áudio...</span>
        </div>
    );

    return (
        <>
            <div className="px-2 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 border-t border-gray-200 bg-gray-50 sticky bottom-0 shadow- ऊपर-md z-20">
                {errorFromAI && (
                    <div className="mb-2 p-2 text-xs text-red-700 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
                        <IoWarningOutline className="flex-shrink-0 text-base" /> <span>{errorFromAI}</span>
                    </div>
                )}
                {audioError && (
                    <div className="mb-2 p-2 text-xs text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-md flex items-center gap-2">
                        <IoWarningOutline className="flex-shrink-0 text-base" /> <span>{audioError}</span>
                    </div>
                )}

                {/* Display area for attached files (including recorded audio) */}
                {/* Show this area if attachments are enabled OR if there's recorded audio, and there are files */}
                {((settings.enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) && attachedFiles.length > 0 && !isRecording) && (
                    <div className="mb-2 p-2 bg-gray-100 border border-gray-200 rounded-lg flex gap-2.5 items-center max-h-60 overflow-y-auto shadow-sm">
                        {attachedFiles.map(item => {
                            // Only display non-audio files if general attachments are enabled
                            if (!item.file.type.startsWith('audio/') && !settings.enableAttachments) {
                                return null;
                            }

                            const isVisualMedia = (item.type.startsWith('image/') || item.type.startsWith('video/')) && item.previewUrl;
                            const mediaClasses = isVisualMedia ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

                            if (item.type.startsWith('audio/') && item.previewUrl) {
                                return (
                                    <div key={item.id} className="relative group w-full max-w-xs bg-transparent p-0 rounded-lg">
                                        <CustomAudioPlayer src={item.previewUrl} fileName={item.name} />
                                        <Button
                                            variant="icon"
                                            className="!absolute top-2 right-2 !p-1.5 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-60 hover:opacity-100 group-hover:opacity-100 transition-all duration-200 ease-in-out transform hover:scale-110 focus:opacity-100 focus:scale-110 z-20"
                                            onClick={() => handleRemoveFile(item.id)}
                                            aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
                                        > <IoClose size={14} /> </Button>
                                    </div>
                                );
                            } else if (item.type.startsWith('image/') && item.previewUrl) {
                                return (
                                    <div key={item.id} className="relative group bg-white p-1.5 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 self-start max-w-[calc(100%-1rem)]">
                                        <img
                                            src={item.previewUrl} alt={`Preview ${item.name}`}
                                            className={`object-cover rounded-md ${mediaClasses}`}
                                            style={{ maxHeight: `${MAX_THUMBNAIL_SIZE * 1.5}px`, maxWidth: `${MAX_THUMBNAIL_SIZE * 1.5}px` }}
                                            onLoad={() => { if (item.previewUrl && item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl); }}
                                            onClick={() => openMediaModalInput(item)}
                                            title={`${item.name} - Clique para ampliar`}
                                        />
                                        <Button
                                            variant="icon"
                                            className="!absolute -top-2 -right-2 !p-1 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out transform group-hover:scale-110 focus:opacity-100 focus:scale-110"
                                            onClick={() => handleRemoveFile(item.id)}
                                            aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
                                        > <IoClose size={16} /> </Button>
                                    </div>
                                );
                            } else if (item.type.startsWith('video/') && item.previewUrl) {
                                return (
                                    <div key={item.id} className="relative group bg-white p-1.5 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 self-start max-w-[calc(100%-1rem)]">
                                        <div
                                            className={`relative w-full h-full object-cover rounded-md flex items-center justify-center bg-black ${mediaClasses}`}
                                            style={{ maxWidth: `${MAX_THUMBNAIL_SIZE * 2}px`, maxHeight: `${MAX_THUMBNAIL_SIZE * 1.5}px` }}
                                            onClick={() => openMediaModalInput(item)}
                                            title={`${item.name} - Clique para ampliar`}
                                        >
                                            <video
                                                src={item.previewUrl}
                                                className="object-contain rounded-md pointer-events-none"
                                                style={{ maxWidth: '100%', maxHeight: '100%' }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <IoVideocamOutline size={30} className="text-white/80" />
                                            </div>
                                        </div>
                                        <Button
                                            variant="icon"
                                            className="!absolute -top-2 -right-2 !p-1 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out transform group-hover:scale-110 focus:opacity-100 focus:scale-110"
                                            onClick={() => handleRemoveFile(item.id)}
                                            aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
                                        > <IoClose size={16} /> </Button>
                                    </div>
                                );
                            }
                            // Generic file display (non-audio, non-image, non-video with preview)
                            return (
                                <div key={item.id} className="relative group bg-white p-1.5 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 self-start" style={{ width: `${MAX_THUMBNAIL_SIZE}px`, height: `${MAX_THUMBNAIL_SIZE}px` }}>
                                    <div className="flex flex-col items-center justify-center bg-gray-100 text-gray-700 rounded-sm text-[10px] p-1 break-all w-full h-full" style={{ overflowWrap: 'break-word', wordBreak: 'break-all', whiteSpace: 'normal', lineHeight: 'tight' }} title={item.name}>
                                        {item.type.startsWith('image/') ? <IoImageOutline size={26} className="mb-1 text-gray-500" />
                                            : item.type.startsWith('video/') ? <IoVideocamOutline size={26} className="mb-1 text-gray-500" />
                                                : <IoDocumentTextOutline size={26} className="mb-1 text-gray-500" />}
                                        <span className='truncate w-full text-center'>{item.name}</span>
                                        <span className='text-gray-400 text-[9px] mt-0.5'>{Math.round(item.size / 1024)} KB</span>
                                    </div>
                                    <Button
                                        variant="icon"
                                        className="!absolute -top-2 -right-2 !p-1 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out transform group-hover:scale-110 focus:opacity-100 focus:scale-110"
                                        onClick={() => handleRemoveFile(item.id)}
                                        aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
                                    > <IoClose size={16} /> </Button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        if (isCurrentlyLoading) { e.preventDefault(); handleAbortAIResponse(); }
                        else if (!isRecording) { handleSubmit(e); }
                        else { e.preventDefault(); }
                    }}
                    className={`flex items-end bg-white border border-gray-300 rounded-xl p-1.5 shadow-lg
                                focus-within:ring-2 focus-within:ring-[#e04579] focus-within:border-[#e04579]/70
                                transition-all duration-200 ease-in-out
                                ${isRecording ? 'ring-2 !ring-red-500/80 !border-red-500/80' : ''}
                                ${isTextareaFocused && !isRecording ? '!border-[#e04579]/70 ring-2 ring-[#e04579]' : ''}`}
                >
                    <div className="flex-shrink-0 p-0.5 flex items-center space-x-0.5">
                        {settings.enableWebSearch && (
                            <Button type="button" variant="icon"
                                className={`!p-2.5 rounded-lg transform active:scale-90 transition-colors duration-150 ${isWebSearchEnabledForNextMessage ? 'bg-[#e04579] text-white hover:bg-[#c73d6a]' : 'text-gray-500 hover:text-[#e04579] hover:bg-pink-50'}`}
                                onClick={() => setIsWebSearchEnabledForNextMessage(prev => !prev)} disabled={isWebSearchButtonDisabled}
                                aria-label={isWebSearchEnabledForNextMessage ? "Desativar busca na web para a próxima mensagem" : "Ativar busca na web para a próxima mensagem"}
                                title={isWebSearchEnabledForNextMessage ? "Busca na web ATIVADA para a próxima mensagem. Clique para desativar." : "Ativar busca na web para a próxima mensagem."}
                            > <IoEarthOutline size={20} /> </Button>
                        )}
                        {isRecording ? (
                            <Button type="button" variant="icon" className="!p-2.5 text-red-500 hover:text-red-700 !bg-red-100 hover:!bg-red-200 rounded-lg transform active:scale-90" onClick={handleCancelRecording} aria-label="Cancelar gravação" title="Cancelar gravação">
                                <IoClose size={22} />
                            </Button>
                        ) : (
                            settings.enableAttachments && ( // Attach button only shown if general attachments are enabled
                                <Button type="button" variant="icon" className="!p-2.5 text-gray-500 hover:text-[#e04579] hover:bg-pink-50 rounded-lg transform active:scale-90" onClick={() => fileInputRef.current?.click()} disabled={isAttachButtonDisabled} aria-label="Anexar arquivos" title="Anexar arquivos">
                                    <IoAttach size={20} />
                                </Button>
                            )
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} multiple onChange={handleFileChange} className="hidden" accept="image/*,audio/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/zip,application/x-rar-compressed" disabled={isAttachButtonDisabled} />

                    <div className="flex-1 mx-1.5 relative flex items-center">
                        {isRecording && ( // Show recording placeholder regardless of settings.enableAttachments
                            <div className="absolute inset-0 flex items-center justify-start pl-3 pointer-events-none z-10">
                                {recordingPlaceholder}
                            </div>
                        )}
                        <textarea ref={textareaRef} rows={1} value={text} onChange={(e) => setText(e.target.value)}
                            onKeyDown={handleKeyDown} onFocus={() => setIsTextareaFocused(true)} onBlur={() => setIsTextareaFocused(false)}
                            placeholder={isRecording ? '' : (isCurrentlyLoading ? 'IA respondendo...' : placeholderText)}
                            className={`w-full bg-transparent text-gray-800 placeholder-gray-500 focus:outline-none py-2.5 resize-none leading-tight transition-all duration-200 ease-in-out ${isRecording ? 'text-transparent caret-transparent' : ''} ${isCurrentlyLoading && !isRecording ? 'placeholder-gray-400' : ''}`}
                            style={{ maxHeight: isTextareaFocused ? `${window.innerHeight * (FOCUSED_TEXTAREA_MAX_HEIGHT_VH / 100)}px` : `${getPixelValueFromRem(UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM)}px`, minHeight: `${getPixelValueFromRem(UNFOCUSED_TEXTAREA_MAX_HEIGHT_REM)}px` }}
                            disabled={!activeConversationId || !settings.apiKey || isProcessingEditedMessage || isLoadingAI || isRecording}
                            aria-label="Campo de entrada de mensagem"
                        />
                    </div>

                    <div className="flex-shrink-0 p-0.5 flex items-center space-x-1.5">
                        {/* Mic button is always shown, its disabled state is handled by isMicDisabled */}
                        <Button type="button" variant={isRecording ? "danger" : "icon"}
                            className={`!p-2.5 rounded-lg transform active:scale-90 ${isRecording ? '!bg-red-600 hover:!bg-red-700 text-white animate-pulseRing' : 'text-gray-500 hover:text-[#e04579] hover:bg-pink-50'}`}
                            onClick={handleMicButtonClick} disabled={isMicDisabled}
                            aria-label={isRecording ? "Parar gravação e anexar áudio" : "Iniciar gravação de áudio"}
                            title={isRecording ? "Parar gravação e anexar áudio" : "Iniciar gravação de áudio"}
                        > {isRecording ? <IoStopCircleOutline size={20} /> : <IoMicOutline size={20} />} </Button>
                        
                        {!isRecording && (
                            <Button type={isCurrentlyLoading ? "button" : "submit"} onClick={isCurrentlyLoading ? handleAbortAIResponse : undefined}
                                variant={isCurrentlyLoading ? "danger" : "primary"}
                                className={`!p-2.5 rounded-lg transform active:scale-90 group overflow-hidden ${isCurrentlyLoading ? 'hover:!bg-red-700' : canSubmitEffectively ? 'hover:!bg-[#c73d6a]' : '!bg-gray-300 !text-gray-500 cursor-not-allowed'}`}
                                disabled={isCurrentlyLoading ? false : !canSubmitEffectively}
                                aria-label={isCurrentlyLoading ? "Abortar resposta" : "Enviar mensagem"}
                                title={isCurrentlyLoading ? "Abortar resposta" : "Enviar mensagem"}
                            > <span className="block transition-transform duration-200 ease-in-out group-hover:scale-110"> {isCurrentlyLoading ? <IoStop size={20} /> : <IoPaperPlaneOutline size={20} />} </span> </Button>
                        )}
                    </div>
                </form>
                {!settings.apiKey && activeConversationId && !isCurrentlyLoading && !isRecording && (
                    <p className="text-xs text-yellow-600 text-center mt-2.5 px-2">
                        Chave de API não configurada. Por favor, adicione sua chave nas <strong className="font-medium text-yellow-700">Configurações</strong> para interagir com a IA.
                    </p>
                )}
            </div>
            <MediaModal
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
