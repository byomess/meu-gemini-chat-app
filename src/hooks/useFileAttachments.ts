// src/hooks/useFileAttachments.ts
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppSettings } from '../types'; // For settings.enableAttachments

export interface LocalAttachedFile {
    id: string;
    file: File;
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
    isRecording?: boolean; // To distinguish recorded audio if needed
}

const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

interface UseFileAttachmentsProps {
    enableAttachments: AppSettings['enableAttachments'];
    isRecordingAudio: boolean; // To allow adding recorded audio even if general attachments are off
    textareaFocused: boolean; // To control paste behavior
}

export function useFileAttachments({ enableAttachments, isRecordingAudio, textareaFocused }: UseFileAttachmentsProps) {
    const [attachedFiles, setAttachedFiles] = useState<LocalAttachedFile[]>([]);

    const addFilesToState = useCallback(async (files: FileList | File[], isRecordedAudio = false) => {
        if (!enableAttachments && !isRecordedAudio) return;
        // Do not add files if currently recording audio, unless it's the recorded audio itself
        if (isRecordingAudio && !isRecordedAudio) return;


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
                        // Fallback for images if dataURL fails (e.g., very large images)
                        if (file.type.startsWith('image/')) {
                            try {
                                previewUrl = URL.createObjectURL(file); // Remember to revoke this
                            } catch (e2) {
                                console.error("Error creating ObjectURL for image preview:", e2);
                            }
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
                    isRecording: isRecordedAudio ? false : undefined,
                };
            })();
            newFilesPromises.push(newAttachedFilePromise);
        }

        const newFilesResolved = (await Promise.all(newFilesPromises)).filter(f => f !== null) as LocalAttachedFile[];
        setAttachedFiles(prevFiles => [...prevFiles, ...newFilesResolved]);
    }, [enableAttachments, isRecordingAudio]);

    const handleRemoveFile = useCallback((fileIdToRemove: string) => {
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
    }, []);

    const clearAttachmentsFromState = useCallback(() => {
        attachedFiles.forEach(f => {
            if (f.previewUrl && f.previewUrl.startsWith('blob:')) { // Only revoke ObjectURLs
                URL.revokeObjectURL(f.previewUrl);
            }
        });
        setAttachedFiles([]);
    }, [attachedFiles]);

    // Effect to revoke object URLs on unmount or when files are cleared
    useEffect(() => {
        const currentFiles = [...attachedFiles];
        return () => {
            currentFiles.forEach(f => {
                if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(f.previewUrl);
                }
            });
        };
    }, []); // Empty dependency array means this runs on unmount for the component using the hook

    const handlePasteInternal = useCallback(async (event: ClipboardEvent) => {
        if (!enableAttachments || isRecordingAudio || !textareaFocused) return;
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
                await addFilesToState(filesToPaste, false);
            }
        }
    }, [enableAttachments, isRecordingAudio, textareaFocused, addFilesToState]);

    return {
        attachedFiles,
        setAttachedFiles, // Exposing for direct manipulation if needed, e.g., after submission
        addFilesToState,
        handleRemoveFile,
        clearAttachmentsFromState,
        handlePasteInternal,
    };
}
