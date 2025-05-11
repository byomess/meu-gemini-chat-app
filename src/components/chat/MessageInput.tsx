// src/components/chat/MessageInput.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../common/Button';
import { IoSend, IoPulseOutline, IoWarningOutline, IoAttach, IoCloseCircleOutline } from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import { streamMessageToGemini, type StreamedGeminiResponseChunk, type FileDataPart } from '../../services/geminiService';
import type { MessageMetadata, AttachedFileInfo } from '../../types/conversation'; // Certifique-se que o caminho está correto
import { v4 as uuidv4 } from 'uuid';

interface LocalAttachedFile {
    id: string;
    file: File;
    name: string;
    type: string;
    size: number;
    previewUrl?: string; // URL.createObjectURL() para preview no input
}

// Função para converter File para string Base64 (apenas os dados)
const fileToBase64Data = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            if (base64String) {
                resolve(base64String);
            } else {
                reject(new Error("Falha ao converter arquivo para Base64: string vazia."));
            }
        };
        reader.onerror = (error) => reject(error);
    });
};

// Função para converter File para string Data URL completa (data:mime;base64,...)
const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};


const MessageInput: React.FC = () => {
    const {
        activeConversationId,
        addMessageToConversation,
        updateMessageInConversation,
        isProcessingEditedMessage,
        conversations,
    } = useConversations();
    const { settings } = useAppSettings();
    const { memories: globalMemoriesFromHook, addMemory, updateMemory, deleteMemory: deleteMemoryFromHook } = useMemories();

    const [text, setText] = useState<string>('');
    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
    const [errorFromAI, setErrorFromAI] = useState<string | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<LocalAttachedFile[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const MAX_TEXTAREA_HEIGHT = 160;
    const MAX_THUMBNAIL_SIZE = 80;

    const adjustTextareaHeight = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
            textareaRef.current.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
        }
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [text, adjustTextareaHeight]);

    useEffect(() => {
        if (activeConversationId && textareaRef.current && text === '' && !isLoadingAI && !isProcessingEditedMessage && attachedFiles.length === 0) {
            textareaRef.current.focus();
        }
    }, [activeConversationId, text, isLoadingAI, isProcessingEditedMessage, attachedFiles]);

    useEffect(() => {
        if (text !== '' && errorFromAI) {
            setErrorFromAI(null);
        }
    }, [text, errorFromAI]);

    useEffect(() => {
        const currentFiles = [...attachedFiles];
        return () => {
            currentFiles.forEach(f => {
                if (f.previewUrl) {
                    URL.revokeObjectURL(f.previewUrl);
                }
            });
        };
    }, [attachedFiles]);


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newFiles: LocalAttachedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
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
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveFile = (fileIdToRemove: string) => {
        setAttachedFiles(prevFiles =>
            prevFiles.filter(f => {
                if (f.id === fileIdToRemove) {
                    if (f.previewUrl) {
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
            if (f.previewUrl) {
                URL.revokeObjectURL(f.previewUrl);
            }
        });
        setAttachedFiles([]);
    }

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorFromAI(null);
        const trimmedText = text.trim();

        if ((!trimmedText && attachedFiles.length === 0) || !activeConversationId || isLoadingAI || isProcessingEditedMessage) {
            return;
        }

        if (!settings.apiKey) {
            addMessageToConversation(activeConversationId, {
                text: "Erro: Chave de API não configurada.",
                sender: 'ai',
                metadata: { error: true }
            });
            setText('');
            clearAttachmentsFromState();
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            return;
        }
        
        // O texto para a IA é apenas o texto puro.
        const currentTextForAI = trimmedText;

        const conversationForHistory = conversations.find(c => c.id === activeConversationId);
        const historyBeforeCurrentUserMessage = conversationForHistory?.messages.map(msg => ({
            sender: msg.sender,
            text: msg.text // Histórico para IA não precisa de anexos
        })) || [];
        
        // Preparar attachedFilesInfo para os metadados da mensagem do usuário
        // Importante: Para persistência entre sessões, precisamos do Data URL completo para imagens
        const filesInfoForUIMessagePromises = attachedFiles.map(async (localFile): Promise<AttachedFileInfo> => {
            let dataUrlForStorage: string | undefined = undefined;
            if (localFile.type.startsWith('image/')) {
                try {
                    dataUrlForStorage = await fileToDataURL(localFile.file);
                } catch (err) {
                    console.error(`Falha ao converter ${localFile.name} para Data URL:`, err);
                    // Usa o previewUrl local (blob) como fallback se a conversão para Data URL falhar,
                    // mas isso não persistirá entre sessões.
                    dataUrlForStorage = localFile.previewUrl;
                }
            }
            return {
                id: localFile.id,
                name: localFile.name,
                type: localFile.type,
                size: localFile.size,
                dataUrl: dataUrlForStorage, // Salva o Data URL completo para imagens
            };
        });

        const resolvedFilesInfoForUIMessage = await Promise.all(filesInfoForUIMessagePromises);
        
        // Adiciona a mensagem do usuário à UI com o texto original e metadados dos anexos
        addMessageToConversation(activeConversationId, {
            text: trimmedText, // APENAS o texto que o usuário digitou
            sender: 'user',
            metadata: {
                attachedFilesInfo: resolvedFilesInfoForUIMessage.length > 0 ? resolvedFilesInfoForUIMessage : undefined
            }
        });
        
        setText('');
        // Não limpe os anexos do estado local ainda, precisaremos deles para a API
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
            clearAttachmentsFromState(); // Limpa os arquivos do estado local se houver erro precoce
            return;
        }

        let memoryOperationsFromServer: StreamedGeminiResponseChunk['memoryOperations'] = [];
        let streamError: string | null = null;
        let finalCleanedTextForMessage = "";

        try {
            const currentGlobalMemoriesWithObjects = globalMemoriesFromHook.map(mem => ({ id: mem.id, content: mem.content }));

            const fileDataPartsForAPI: FileDataPart[] = [];
            for (const localFile of attachedFiles) { // Itera sobre o estado local `attachedFiles`
                try {
                    if (localFile.file.type.startsWith("image/")) { // Somente imagens para a API
                        const base64Data = await fileToBase64Data(localFile.file); // Usa a função que retorna só os dados base64
                        fileDataPartsForAPI.push({
                            mimeType: localFile.file.type,
                            data: base64Data,
                        });
                    }
                } catch (conversionError) {
                    console.error(`Falha ao converter arquivo ${localFile.name} para Base64 para API:`, conversionError);
                    setErrorFromAI(`Falha ao processar o arquivo para API: ${localFile.name}.`);
                }
            }
            
            // Limpa os arquivos do estado local AGORA, pois já foram processados para UI e API
            clearAttachmentsFromState();

            for await (const streamResponse of streamMessageToGemini(
                settings.apiKey,
                historyBeforeCurrentUserMessage,
                currentTextForAI,
                fileDataPartsForAPI,
                currentGlobalMemoriesWithObjects
            )) {
                // ... (lógica do stream) ...
                if (streamResponse.delta) {
                    finalCleanedTextForMessage += streamResponse.delta;
                    updateMessageInConversation(activeConversationId, aiMessageId, {
                        text: finalCleanedTextForMessage + "▍",
                        metadata: { isLoading: true }
                    });
                }
                if (streamResponse.error) {
                    streamError = streamResponse.error;
                    break;
                }
                if (streamResponse.isFinished) {
                    finalCleanedTextForMessage = streamResponse.finalText || finalCleanedTextForMessage;
                    memoryOperationsFromServer = streamResponse.memoryOperations || [];
                    break;
                }
            }

            // ... (lógica de tratamento de erro do stream e operações de memória) ...
             if (streamError) {
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: (finalCleanedTextForMessage || "") + 
                          ((finalCleanedTextForMessage) ? '\n\n--- ERRO ---\n' : '') + 
                          streamError,
                    metadata: { isLoading: false, error: true } // Marcar como erro
                });
                setErrorFromAI(streamError);
            } else {
                const processedMemoryActions: Required<MessageMetadata>['memorizedMemoryActions'] = [];

                if (memoryOperationsFromServer && memoryOperationsFromServer.length > 0) {
                    memoryOperationsFromServer.forEach(op => {
                         if (op.action === 'create' && op.content) {
                            const newMemoryObject = addMemory(op.content);
                             if (newMemoryObject) {
                                processedMemoryActions.push({
                                    id: newMemoryObject.id,
                                    content: newMemoryObject.content,
                                    action: 'created'
                                });
                            }
                        } else if (op.action === 'update' && op.targetMemoryContent && op.content) {
                            const memoryToUpdate = globalMemoriesFromHook.find(
                                mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase()
                            );
                            if (memoryToUpdate) {
                                updateMemory(memoryToUpdate.id, op.content);
                                processedMemoryActions.push({
                                    id: memoryToUpdate.id,
                                    content: op.content,
                                    originalContent: memoryToUpdate.content,
                                    action: 'updated'
                                });
                            } else { // Fallback: criar como nova se não encontrar para atualizar
                                const newMemoryObject = addMemory(op.content);
                                if (newMemoryObject) {
                                    processedMemoryActions.push({
                                        id: newMemoryObject.id,
                                        content: newMemoryObject.content,
                                        action: 'created'
                                    });
                                }
                            }
                        } else if (op.action === 'delete_by_ai_suggestion' && op.targetMemoryContent) {
                            const memoryToDelete = globalMemoriesFromHook.find(
                                mem => mem.content.toLowerCase() === op.targetMemoryContent?.toLowerCase()
                            );
                            if (memoryToDelete) {
                                deleteMemoryFromHook(memoryToDelete.id);
                                processedMemoryActions.push({
                                    id: memoryToDelete.id,
                                    content: memoryToDelete.content,
                                    originalContent: memoryToDelete.content,
                                    action: 'deleted_by_ai'
                                });
                            }
                        }
                    });
                }
                updateMessageInConversation(activeConversationId, aiMessageId, {
                    text: finalCleanedTextForMessage,
                    metadata: { 
                        isLoading: false, 
                        memorizedMemoryActions: processedMemoryActions.length > 0 ? processedMemoryActions : undefined,
                    }
                });
            }

        } catch (error: unknown) {
            console.error("Falha catastrófica ao processar stream com Gemini:", error);
            const clientErrorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu uma falha desconhecida no processamento da resposta.";
            updateMessageInConversation(activeConversationId, aiMessageId, {
                text: "", // Em caso de falha catastrófica, não mostrar texto parcial da IA
                metadata: { isLoading: false, error: clientErrorMessage } // Armazenar o erro real
            });
            setErrorFromAI(clientErrorMessage);
        } finally {
            setIsLoadingAI(false);
            if (attachedFiles.length > 0) clearAttachmentsFromState(); // Garantir limpeza
            if (textareaRef.current && settings.apiKey && !streamError && !errorFromAI && !isProcessingEditedMessage) {
                textareaRef.current.focus();
            }
        }
    };

    // ... (o resto do MessageInput.tsx, incluindo handleKeyDown e JSX, permanece como no seu último fornecimento)
    // A preview local dos anexos (abaixo do textarea) já usa `item.previewUrl` que é o `URL.createObjectURL()`.
    // A mudança principal é como a mensagem é *salva* via `addMessageToConversation`.

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isLoadingAI || isProcessingEditedMessage) {
            if (e.key === 'Enter') e.preventDefault();
            return;
        }
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && (text.trim().length > 0 || attachedFiles.length > 0)) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Enter' && e.ctrlKey) {
             e.preventDefault();
             handleSubmit();
        }
    };

    const isOverallBusy = isLoadingAI || isProcessingEditedMessage;
    const canSubmit = (text.trim().length > 0 || attachedFiles.length > 0) && !!activeConversationId && !isOverallBusy && !!settings.apiKey;
    const isInputDisabled = !activeConversationId || !settings.apiKey || isOverallBusy;

    const placeholderText =
        isProcessingEditedMessage ? "Processando edição anterior..." :
            isLoadingAI ? "Gemini está respondendo..." :
                activeConversationId ?
                    (settings.apiKey ? "Digite sua mensagem... (Enter para enviar / Shift+Enter ou Ctrl+Enter para nova linha)" : "Configure sua API Key nas Configurações.") :
                    "Selecione ou crie uma conversa.";

    return (
        <div className="px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 border-t border-slate-700/60 bg-slate-800/90 backdrop-blur-sm sticky bottom-0">
            {errorFromAI && (
                <div className="mb-2 p-2 text-xs text-red-400 bg-red-900/30 rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0" />
                    <span>{errorFromAI}</span>
                </div>
            )}

            {attachedFiles.length > 0 && (
                <div className="mb-2 p-2 bg-slate-800/70 rounded-md flex flex-wrap gap-2 items-start max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50">
                    {attachedFiles.map(item => (
                        <div key={item.id} className="relative group bg-slate-700 p-1 rounded shadow">
                            {item.previewUrl && item.type.startsWith('image/') ? ( // Verifica se é imagem para exibir img tag
                                <img
                                    src={item.previewUrl}
                                    alt={`Preview ${item.name}`}
                                    className="object-cover rounded"
                                    style={{ width: `${MAX_THUMBNAIL_SIZE}px`, height: `${MAX_THUMBNAIL_SIZE}px` }}
                                />
                            ) : (
                                <div 
                                    className="flex items-center justify-center bg-slate-600 text-slate-300 rounded text-xs p-2 break-all"
                                    style={{ width: `${MAX_THUMBNAIL_SIZE}px`, height: `${MAX_THUMBNAIL_SIZE}px`, overflow: 'hidden' }}
                                    title={item.name}
                                >
                                    <span className='truncate'>{item.name}</span>
                                </div>
                            )}
                            <Button
                                variant="danger"
                                className="absolute -top-1 -right-1 !p-0.5 rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveFile(item.id)}
                                aria-label={`Remover ${item.name}`}
                            >
                                <IoCloseCircleOutline size={18} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="flex items-end bg-slate-900/80 rounded-xl p-1.5 pr-2 shadow-md focus-within:ring-2 focus-within:ring-blue-500/70 transition-shadow duration-200"
            >
                <Button
                    type="button"
                    className="mr-2 !p-2 sm:!p-2.5 rounded-lg text-slate-400 hover:text-slate-200"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isInputDisabled || isOverallBusy}
                    aria-label="Anexar arquivos"
                >
                    <IoAttach size={20} />
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    disabled={isInputDisabled || isOverallBusy}
                />

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