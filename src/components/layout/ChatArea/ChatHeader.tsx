import React from 'react';
import { IoChatbubblesOutline, IoMenuOutline, IoSyncOutline, IoEllipsisVertical, IoTrashBinOutline, IoSearchOutline } from 'react-icons/io5';
import { GhostIcon } from 'lucide-react';
import type { GoogleDriveSyncStatus } from '../../../types';
import Dropdown from '../../common/Dropdown'; // Import the new Dropdown component
import DropdownItem from '../../common/DropdownItem'; // Import the new DropdownItem component

interface ChatHeaderProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean;
    isIncognito: boolean;
    conversationTitle: string;
    googleDriveSyncStatus: GoogleDriveSyncStatus;
    // Novas propriedades para as ações do dropdown
    onClearChat: () => void; // Callback para limpar o chat
    onSearchMessages: () => void; // Callback para buscar mensagens
    isMobile: boolean; // NOVA PROPRIEDADE: Indica se o dispositivo é móvel
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onOpenMobileSidebar,
    showMobileMenuButton,
    isIncognito,
    conversationTitle,
    googleDriveSyncStatus,
    onClearChat,
    onSearchMessages,
    isMobile // Desestruturar a nova propriedade
}) => {
    return (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-md bg-[var(--color-chat-header-bg)] border-b border-[var(--color-chat-header-border)] shadow-sm">
            {/* O botão de menu só será renderizado se for mobile E showMobileMenuButton for true */}
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

            {/* Menu de dropdown usando o novo componente Dropdown */}
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
                    Buscar mensagens
                </DropdownItem>
            </Dropdown>
        </div>
    );
};
