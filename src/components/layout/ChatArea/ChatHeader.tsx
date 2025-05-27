import React, { useState, useRef, useEffect } from 'react';
import { IoChatbubblesOutline, IoMenuOutline, IoSyncOutline, IoEllipsisVertical } from 'react-icons/io5';
import { GhostIcon } from 'lucide-react';
import type { GoogleDriveSyncStatus } from '../../../types';

interface ChatHeaderProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean;
    isIncognito: boolean;
    conversationTitle: string;
    googleDriveSyncStatus: GoogleDriveSyncStatus;
    // Novas propriedades para as ações do dropdown
    onClearChat: () => void; // Callback para limpar o chat
    onSearchMessages: () => void; // Callback para buscar mensagens
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onOpenMobileSidebar,
    showMobileMenuButton,
    isIncognito,
    conversationTitle,
    googleDriveSyncStatus,
    onClearChat,
    onSearchMessages
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fecha o dropdown ao clicar fora dele
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleClearChat = () => {
        setIsDropdownOpen(false); // Fecha o dropdown
        onClearChat(); // Chama o handler do componente pai
    };

    const handleSearchMessages = () => {
        setIsDropdownOpen(false); // Fecha o dropdown
        onSearchMessages(); // Chama o handler do componente pai
    };

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

            {/* Menu de dropdown */}
            <div className="relative ml-auto" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="p-1 text-[var(--color-mobile-menu-button-text)] hover:text-[var(--color-mobile-menu-button-hover-text)]"
                    title="Mais opções"
                    aria-label="Mais opções"
                >
                    <IoEllipsisVertical size={24} />
                </button>

                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-[var(--color-dropdown-bg)] border border-[var(--color-dropdown-border)] rounded-md shadow-lg z-30">
                        <button
                            onClick={handleClearChat}
                            className="block w-full text-left px-4 py-2 text-sm text-[var(--color-dropdown-item-text)] hover:bg-[var(--color-dropdown-item-hover-bg)] hover:text-[var(--color-dropdown-item-hover-text)]"
                        >
                            Limpar chat
                        </button>
                        <button
                            onClick={handleSearchMessages}
                            className="block w-full text-left px-4 py-2 text-sm text-[var(--color-dropdown-item-text)] hover:bg-[var(--color-dropdown-item-hover-bg)] hover:text-[var(--color-dropdown-item-hover-text)]"
                        >
                            Buscar mensagens
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
