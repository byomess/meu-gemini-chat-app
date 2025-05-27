import MessageInput from '../../chat/MessageInput'
import MessageBubble from '../../chat/MessageBubble'
import { useConversations } from '../../../contexts/ConversationContext'
import { useAppSettings } from '../../../contexts/AppSettingsContext'
import useIsMobile from '../../../hooks/useIsMobile'
import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'
import { ChatHeader } from './ChatHeader'
import { ScrollToBottomButton } from './ScrollToBottomButton'
import { WelcomeDisplay } from './WelcomeDisplay'
import { ApiKeyMissingDisplay } from './ApiKeyMissingDisplay'
import { NoMessagesDisplay } from './NoMessagesDisplay'
import { useDialog } from '../../../contexts/DialogContext'
import TextInput from '../../common/TextInput'
import { IoCloseOutline } from 'react-icons/io5'

interface ChatAreaProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({ onOpenMobileSidebar, showMobileMenuButton }) => {
    const {
        activeConversation,
        activeConversationId,
        clearMessagesInConversation,
    } = useConversations()
    const { settings } = useAppSettings()
    const isMobile = useIsMobile()
    const { showDialog } = useDialog();

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null); // NEW: Ref for the search input

    const messages = activeConversation?.messages || []
    const conversationTitle = activeConversation?.title || 'Chat'
    const isIncognito = activeConversation?.isIncognito || false;

    const scrollToBottom = useCallback(() => {
        const container = chatContainerRef.current
        if (container && messagesEndRef.current) {
            const scrollHeight = container.scrollHeight
            const clientHeight = container.clientHeight
            const scrollTop = container.scrollTop
            const targetScrollTop = scrollHeight - clientHeight
            const distanceToBottom = targetScrollTop - scrollTop
            const duration = 300
            const startTime = performance.now()
            const animateScroll = (currentTime: number) => {
                const elapsedTime = currentTime - startTime
                const progress = Math.min(elapsedTime / duration, 1)
                const easing = 0.5 - Math.cos(progress * Math.PI) / 2
                container.scrollTop = scrollTop + distanceToBottom * easing
                if (progress < 1) {
                    requestAnimationFrame(animateScroll)
                }
            }
            requestAnimationFrame(animateScroll)
        }
    }, [])

    useEffect(() => {
        // Auto scroll to bottom when new messages are added
        if (messagesEndRef.current) {
            const container = chatContainerRef.current
            if (container) {
                const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10
                if (isAtBottom) {
                    scrollToBottom()
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, scrollToBottom])

    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) {
            return;
        }

        if (activeConversationId) {
            // When the active conversation changes, scroll to the bottom instantly.
            // setTimeout ensures this runs after the DOM has updated with the new messages,
            // so scrollHeight is calculated correctly.
            setTimeout(() => {
                if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                }
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeConversationId, messages.length]);

    // Effect to handle scroll detection and update isAtBottom state
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = setTimeout(() => {
                if (!chatContainerRef.current) return;

                const currentContainer = chatContainerRef.current;
                const threshold = 10; // Pixels from bottom to consider "at bottom"
                const atBottom = currentContainer.scrollHeight - currentContainer.scrollTop - currentContainer.clientHeight < threshold;
                setIsAtBottom(atBottom);
            }, 100); // Debounce time
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        // Initial check on mount AND when activeConversationId changes
        handleScroll();

        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [activeConversationId]);

    // NEW: Effect to autofocus the search input when it becomes active
    useEffect(() => {
        if (isSearchActive && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchActive]);


    const showWelcome = !activeConversationId
    const showApiKeyMissing = activeConversationId && !settings.apiKey
    // Button is shown only if not welcome, not API key missing, messages exist, AND not at bottom
    const showFloatingButton = !showWelcome && !showApiKeyMissing && messages.length > 0 && !isAtBottom;

    // Determine logo and text based on hostname
    const isAulappDomain = typeof window !== 'undefined' && window.location.hostname === 'aulapp-loox-ai.vercel.app';
    const logoSrc = isAulappDomain ? '/logo-aulapp.svg' : '/logo-loox.png';
    const logoAlt = isAulappDomain ? 'Logo Aulapp' : 'Logo Loox';

    // Handle Clear Chat
    const handleClearChat = useCallback(() => {
        if (!activeConversationId) return;

        showDialog({
            title: 'Limpar Chat',
            message: 'Tem certeza que deseja limpar todas as mensagens deste chat? Esta ação não pode ser desfeita.',
            confirmText: 'Limpar',
            cancelText: 'Cancelar',
            onConfirm: () => {
                clearMessagesInConversation(activeConversationId);
            },
            type: 'confirm',
        });
    }, [activeConversationId, clearMessagesInConversation, showDialog]);

    // Handle Search Messages
    const handleSearchMessages = useCallback(() => {
        setIsSearchActive(prev => !prev);
        if (isSearchActive) { // If closing search, clear term
            setSearchTerm('');
        }
    }, [isSearchActive]);

    // Filter messages based on search term
    const filteredMessages = messages.filter(msg =>
        searchTerm === '' || (msg.text && msg.text.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <main className="flex flex-col h-screen relative text-[var(--color-chat-area-text)] bg-[var(--color-chat-area-bg)]">

            <ChatHeader
                onOpenMobileSidebar={onOpenMobileSidebar}
                showMobileMenuButton={showMobileMenuButton}
                isIncognito={isIncognito}
                conversationTitle={conversationTitle}
                googleDriveSyncStatus={settings.googleDriveSyncStatus}
                onClearChat={handleClearChat}
                onSearchMessages={handleSearchMessages}
            />

            <ScrollToBottomButton
                isVisible={showFloatingButton}
                onClick={scrollToBottom}
            />

            {/* Search Input and Results Count */}
            {isSearchActive && (
                <div className="px-3 md:px-4 py-2 bg-[var(--color-chat-area-bg)] border-b border-[var(--color-chat-header-border)]">
                    <div className="flex items-center gap-2 mb-2"> {/* Added mb-2 for spacing */}
                        <TextInput
                            id="search-messages"
                            name="search-messages"
                            placeholder="Buscar mensagens..."
                            value={searchTerm}
                            onChange={setSearchTerm}
                            type="text"
                            className="flex-grow"
                            ref={searchInputRef} // NEW: Attach the ref here
                        />
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setIsSearchActive(false);
                            }}
                            className="p-1 text-[var(--color-mobile-menu-button-text)] hover:text-[var(--color-mobile-menu-button-hover-text)]"
                            title="Fechar busca"
                            aria-label="Fechar busca"
                        >
                            <IoCloseOutline size={24} />
                        </button>
                    </div>
                    {searchTerm !== '' && (
                        <div className="text-sm text-[var(--color-gray-500)]"> {/* Using a gray color for the count */}
                            {filteredMessages.length} {filteredMessages.length === 1 ? 'resultado' : 'resultados'} encontrada{filteredMessages.length === 1 ? '' : 's'}.
                        </div>
                    )}
                </div>
            )}

            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-3 md:px-4 py-4 md:py-6"
            >
                {showWelcome ? (
                    <WelcomeDisplay
                        isMobile={isMobile}
                        showMobileMenuButton={showMobileMenuButton}
                        logoSrc={logoSrc}
                        logoAlt={logoAlt}
                    />
                ) : showApiKeyMissing ? (
                    <ApiKeyMissingDisplay />
                ) : (isSearchActive && filteredMessages.length === 0 && searchTerm !== '') ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--color-no-messages-text-main)]">
                        <p>Nenhuma mensagem encontrada para "{searchTerm}".</p>
                    </div>
                ) : (messages.length === 0 && !isSearchActive) ? (
                    <NoMessagesDisplay />
                ) : (
                    <div className="space-y-4 sm:space-y-5 w-full">
                        {filteredMessages.map(msg => (
                            <MessageBubble key={msg.id} message={msg} conversationId={activeConversationId!} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <MessageInput />
        </main>
    )
}

export default ChatArea
