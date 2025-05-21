// src/components/chat/AttachedFilesPreview.tsx
import React from 'react';
import AttachedFileItem from './AttachedFileItem';
import type { LocalAttachedFile } from '../../hooks/useFileAttachments';

interface AttachedFilesPreviewProps {
    attachedFiles: LocalAttachedFile[];
    onRemoveFile: (fileId: string) => void;
    onOpenMediaPreview: (file: LocalAttachedFile) => void;
    maxThumbnailSize: number;
    enableAttachments: boolean;
    isRecording: boolean; // If currently recording, don't show previews
}

const AttachedFilesPreview: React.FC<AttachedFilesPreviewProps> = ({
    attachedFiles,
    onRemoveFile,
    onOpenMediaPreview,
    maxThumbnailSize,
    enableAttachments,
    isRecording,
}) => {
    const shouldShowArea = (enableAttachments || attachedFiles.some(f => f.file.type.startsWith('audio/'))) &&
                           attachedFiles.length > 0 &&
                           !isRecording;

    if (!shouldShowArea) {
        return null;
    }

    return (
        <div className="mb-2 p-2 bg-gray-100 border border-gray-200 rounded-lg flex gap-2.5 items-center max-h-60 overflow-y-auto shadow-sm">
            {attachedFiles.map(item => {
                // Filter here again for safety, ensuring non-audio files are only shown if enableAttachments is true
                if (!item.file.type.startsWith('audio/') && !enableAttachments) {
                    return null;
                }
                return (
                    <AttachedFileItem
                        key={item.id}
                        item={item}
                        onRemove={onRemoveFile}
                        onPreview={onOpenMediaPreview}
                        maxThumbnailSize={maxThumbnailSize}
                        enableAttachments={enableAttachments}
                    />
                );
            })}
        </div>
    );
};

export default AttachedFilesPreview;
