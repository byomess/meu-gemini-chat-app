// src/components/chat/AttachedFileItem.tsx
import React from 'react';
import Button from '../common/Button';
import CustomAudioPlayer from '../common/CustomAudioPlayer';
import { IoClose, IoVideocamOutline, IoImageOutline, IoDocumentTextOutline } from 'react-icons/io5';
import type { LocalAttachedFile } from '../../hooks/useFileAttachments';

interface AttachedFileItemProps {
    item: LocalAttachedFile;
    onRemove: (fileId: string) => void;
    onPreview: (file: LocalAttachedFile) => void;
    maxThumbnailSize: number;
    enableAttachments: boolean; // To decide if non-audio files are shown (already filtered by parent, but good for safety)
}

const AttachedFileItem: React.FC<AttachedFileItemProps> = ({ item, onRemove, onPreview, maxThumbnailSize, enableAttachments }) => {
    // This component assumes it's only rendered if the item should be visible
    // (i.e., parent component AttachedFilesPreview handles the logic for enableAttachments)
    // However, an extra check for non-audio files can be added if enableAttachments is false.
    if (!item.file.type.startsWith('audio/') && !enableAttachments) {
        return null;
    }

    const isVisualMedia = (item.type.startsWith('image/') || item.type.startsWith('video/')) && item.previewUrl;
    const mediaClasses = isVisualMedia ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

    const handlePreview = () => {
        if (isVisualMedia) {
            onPreview(item);
        }
    };
    
    const handleImageLoad = () => {
        // Revoke blob URL for images once loaded into an <img> tag if it's a blob URL
        // Data URLs (starts with 'data:') should not be revoked.
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl);
        }
    };

    if (item.type.startsWith('audio/') && item.previewUrl) {
        return (
            <div key={item.id} className="relative group w-full max-w-xs bg-transparent p-0 rounded-lg"> {/* Audio items are transparent by design */}
                <CustomAudioPlayer src={item.previewUrl} fileName={item.name} />
                <Button
                    variant="icon"
                    className="!absolute -top-2 -right-2 !p-1.5 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-60 hover:opacity-100 group-hover:opacity-100 transition-all duration-200 ease-in-out transform hover:scale-110 focus:opacity-100 focus:scale-110 z-20"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
                > <IoClose size={14} /> </Button>
            </div>
        );
    } else if (item.type.startsWith('image/') && item.previewUrl) {
        return (
            <div key={item.id} className="relative group bg-[var(--color-attached-item-bg)] p-1.5 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 self-start max-w-[calc(100%-1rem)]">
                <img
                    src={item.previewUrl} alt={`Preview ${item.name}`}
                    className={`object-cover rounded-md ${mediaClasses}`}
                    style={{ maxHeight: `${maxThumbnailSize * 1.5}px`, maxWidth: `${maxThumbnailSize * 1.5}px` }}
                    onLoad={handleImageLoad}
                    onClick={handlePreview}
                    title={`${item.name} - Clique para ampliar`}
                />
                <Button
                    variant="icon"
                    className="!absolute -top-2 -right-2 !p-1 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out transform group-hover:scale-110 focus:opacity-100 focus:scale-110"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
                > <IoClose size={16} /> </Button>
            </div>
        );
    } else if (item.type.startsWith('video/') && item.previewUrl) {
        return (
            <div key={item.id} className="relative group bg-[var(--color-attached-item-bg)] p-1.5 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 self-start max-w-[calc(100%-1rem)]">
                <div
                    className={`relative w-full h-full object-cover rounded-md flex items-center justify-center bg-black ${mediaClasses}`}
                    style={{ maxWidth: `${maxThumbnailSize * 2}px`, maxHeight: `${maxThumbnailSize * 1.5}px` }}
                    onClick={handlePreview}
                    title={`${item.name} - Clique para ampliar`}
                >
                    <video // Videos use src attribute, not onLoad for blob revocation in the same way
                        src={item.previewUrl}
                        className="object-contain rounded-md pointer-events-none"
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                        onLoadedData={() => { // Revoke blob URL for videos once metadata is loaded
                            if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(item.previewUrl);
                            }
                        }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IoVideocamOutline size={30} className="text-white/80" />
                    </div>
                </div>
                <Button
                    variant="icon"
                    className="!absolute -top-2 -right-2 !p-1 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out transform group-hover:scale-110 focus:opacity-100 focus:scale-110"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
                > <IoClose size={16} /> </Button>
            </div>
        );
    }
    // Generic file display (non-audio, non-image, non-video with preview, or preview failed)
    return (
        <div key={item.id} className="relative group bg-[var(--color-attached-item-bg)] p-1.5 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 self-start" style={{ width: `${maxThumbnailSize}px`, height: `${maxThumbnailSize}px` }}>
            <div className="flex flex-col items-center justify-center bg-[var(--color-attached-item-generic-bg)] text-[var(--color-attached-item-generic-text)] rounded-sm text-[10px] p-1 break-all w-full h-full" style={{ overflowWrap: 'break-word', wordBreak: 'break-all', whiteSpace: 'normal', lineHeight: 'tight' }} title={item.name}>
                {item.type.startsWith('image/') ? <IoImageOutline size={26} className="mb-1 text-[var(--color-attached-item-icon)]" />
                    : item.type.startsWith('video/') ? <IoVideocamOutline size={26} className="mb-1 text-[var(--color-attached-item-icon)]" />
                        : <IoDocumentTextOutline size={26} className="mb-1 text-[var(--color-attached-item-icon)]" />}
                <span className='truncate w-full text-center'>{item.name}</span>
                <span className='text-[var(--color-attached-item-subtext)] text-[9px] mt-0.5'>{Math.round(item.size / 1024)} KB</span>
            </div>
            <Button
                variant="icon"
                className="!absolute -top-2 -right-2 !p-1 bg-red-600 hover:!bg-red-700 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out transform group-hover:scale-110 focus:opacity-100 focus:scale-110"
                onClick={() => onRemove(item.id)}
                aria-label={`Remover ${item.name}`} title={`Remover ${item.name}`}
            > <IoClose size={16} /> </Button>
        </div>
    );
};

export default AttachedFileItem;
