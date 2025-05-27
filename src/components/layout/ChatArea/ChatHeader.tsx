import React from 'react';
import { IoChatbubblesOutline, IoMenuOutline, IoSyncOutline } from 'react-icons/io5';
import { GhostIcon } from 'lucide-react';
import { GoogleDriveSyncStatus } from '../../../types';

interface ChatHeaderProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean;
    isIncognito: boolean;
    conversationTitle: string;
    googleDriveSyncStatus: GoogleDriveSyncStatus;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onOpenMobileSidebar,
    showMobileMenuButton,
    isIncognito,
    conversationTitle,
    googleDriveSyncStatus
}) => {
    return (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-md bg-[var(--color-chat-header-bg)] border-b border-[var(--color-chat-header-border)] shadow-sm">
            {showMobileMenuButton && (
                <button
                    onClick={onOpenMobileSidebar}
                    className="p-1 text-[var(--color-mobile-menu-button-text)] hover:text-[var(--color-mobile-menu-button-hover-text)]"
                    title="Abrir menu"
                    aria-label="Abrir menu"
                >
                    <IoMenuOutline size={24} />
                </button>
            )}

            {isIncognito ? (
                <GhostIcon size={22} className="flex-shrink-0 text-[var(--color-chat-header-icon)]" />
            ) : (
                <IoChatbubblesOutline size={22} className="flex-shrink-0 text-[var(--color-chat-header-icon)]" />
            )}
            <h2 className="truncate text-base sm:text-lg font-semibold text-[var(--color-chat-header-title)] flex-grow">
                {conversationTitle}
            </h2>
            {googleDriveSyncStatus === 'Syncing' && (
                <IoSyncOutline className="animate-spin text-[var(--color-chat-header-icon)] ml-2" size={20} />
            )}
        </div>
    );
};
