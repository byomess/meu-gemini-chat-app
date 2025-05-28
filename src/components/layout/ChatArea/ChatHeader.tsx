import React from 'react';
import { IoChatbubblesOutline, IoMenuOutline, IoSyncOutline, IoEllipsisVertical, IoTrashBinOutline, IoSearchOutline } from 'react-icons/io5';
import { GhostIcon } from 'lucide-react';
import type { GoogleDriveSyncStatus } from '../../../types';
import Dropdown from '../../common/Dropdown';
import DropdownItem from '../../common/DropdownItem';
import useIsMobile from '../../../hooks/useIsMobile'; // Import the useIsMobile hook

interface ChatHeaderProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean;
    isIncognito: boolean;
    conversationTitle: string;
    googleDriveSyncStatus: GoogleDriveSyncStatus;
    onClearChat: () => void;
    onSearchMessages: () => void;
    // isMobile: boolean; // REMOVED: This will now be determined internally
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onOpenMobileSidebar,
    showMobileMenuButton,
    isIncognito,
    conversationTitle,
    googleDriveSyncStatus,
    onClearChat,
    onSearchMessages,
}) => {
    const isMobile = useIsMobile(); // Use the hook to determine if it's mobile

    return (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-md bg-[var(--color-chat-header-bg)] border-b border-[var(--color-chat-header-border)] shadow-sm">
            {/* The menu button will only render if it's mobile AND showMobileMenuButton is true */}
            {isMobile && showMobileMenuButton && (
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

            <Dropdown
                className="ml-auto"
                trigger={
                    <button
                        className="p-1 text-[var(--color-mobile-menu-button-text)] hover:text-[var(--color-mobile-menu-button-hover-text)]"
                        title="Mais opções"
                        aria-label="Mais opções"
                    >
                        <IoEllipsisVertical size={24} />
                    </button>
                }
                position="right"
            >
                <DropdownItem onClick={onClearChat} icon={<IoTrashBinOutline size={18} />}>
                    Limpar chat
                </DropdownItem>
                <DropdownItem onClick={onSearchMessages} icon={<IoSearchOutline size={18} />}>
                    Buscar
                </DropdownItem>
            </Dropdown>
        </div>
    );
};
