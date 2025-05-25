import {
    IoChatbubblesOutline,
    IoArrowDownCircleOutline,
    IoLockClosedOutline,
    IoMenuOutline,
} from 'react-icons/io5'
import MessageInput from '../chat/MessageInput'
import MessageBubble from '../chat/MessageBubble'
import { useConversations } from '../../contexts/ConversationContext'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import useIsMobile from '../../hooks/useIsMobile'
import { useCallback, useEffect, useRef, useState } from 'react' // Added useState
import React from 'react'
import { GhostIcon } from 'lucide-react' // Import GhostIcon

interface ChatAreaProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean; // New prop
}

const ChatArea: React.FC<ChatAreaProps> = ({ onOpenMobileSidebar, showMobileMenuButton }) => {
    const {
        activeConversation,
        activeConversationId,
    } = useConversations()
    const { settings } = useAppSettings()
    const isMobile = useIsMobile()

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For debouncing scroll
    const [isAtBottom, setIsAtBottom] = useState(true); // New state to track if user is at bottom

    const messages = activeConversation?.messages || []
    const conversationTitle = activeConversation?.title || 'Chat'
    const isIncognito = activeConversation?.isIncognito || false; // Get incognito status

    const scrollToBottom = useCallback(() => {
        const container = chatContainerRef.current
        if (container && messagesEndRef.current) {
            const scrollHeight = container.scrollHeight
            const clientHeight = container.clientHeight
            const scrollTop = container.scrollTop
            const targetScrollTop = scrollHeight - clientHeight
            const distanceToBottom = targetScrollTop - scrollTop
            const duration = 300 // Duration in ms
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
        console.log(`New messages added: ${messages.length}`)
        console.log(`isAtBottom: ${isAtBottom}`)
        console.log(`scrollToBottom: ${scrollToBottom}`)
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
            }, 0); // 0ms delay defers execution until after the current browser repaint.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeConversationId, messages.length]); // messages.length ensures effect runs when messages for the new conversation are loaded.
                                                // scrollToBottom is removed from dependencies as it's no longer used here.

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
    }, [activeConversationId]); // Add activeConversationId to dependencies


    const handleFloatingButtonClick = () => {
        scrollToBottom()
    }

    const showWelcome = !activeConversationId
    const showApiKeyMissing = activeConversationId && !settings.apiKey
    // Button is shown only if not welcome, not API key missing, messages exist, AND not at bottom
    const showFloatingButton = !showWelcome && !showApiKeyMissing && messages.length > 0 && !isAtBottom;

    // Determine logo and text based on hostname
    const isAulappDomain = typeof window !== 'undefined' && window.location.hostname === 'aulapp-loox-ai.vercel.app';
    const logoSrc = isAulappDomain ? '/logo-aulapp.svg' : '/logo-loox.png';
    const logoAlt = isAulappDomain ? 'Logo Aulapp' : 'Logo Loox';

    return (
        <main className="flex flex-col h-screen relative text-[var(--color-chat-area-text)] bg-[var(--color-chat-area-bg)]">

            <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-md bg-[var(--color-chat-header-bg)] border-b border-[var(--color-chat-header-border)] shadow-sm">
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

                <IoChatbubblesOutline size={22} className="flex-shrink-0 text-[var(--color-chat-header-icon)]" />
                <h2 className="truncate text-base sm:text-lg font-semibold text-[var(--color-chat-header-title)]">
                    {conversationTitle}
                    {isIncognito && (
                        <GhostIcon size={18} className="inline-block ml-2 text-[var(--color-text-secondary)]" title="Conversa Incógnita" />
                    )}
                </h2>
            </div>

            {showFloatingButton && (
                <button
                    onClick={handleFloatingButtonClick}
                    className={`
                        fixed bottom-24 right-6 sm:right-8 z-30
                        p-3 rounded-full
                        shadow-lg shadow-[var(--color-floating-button-shadow)]
                        text-[var(--color-floating-button-text)]
                        hover:scale-105 active:scale-95
                        transition-all duration-150 ease-in-out
                        bg-gradient-to-br from-[var(--color-floating-button-default-from)] to-[var(--color-floating-button-default-to)]
                    `}
                    title="Rolar para o fim"
                    aria-label="Rolar para o fim"
                >
                    <IoArrowDownCircleOutline size={24} />
                </button>
            )}

            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-3 md:px-4 py-4 md:py-6" // Scrollbar styling will be from global CSS or browser default
            >
                {showWelcome ? (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--color-welcome-text-secondary)] p-6 text-center">
                        <img
                            src={logoSrc}
                            alt={logoAlt}
                            className="py-4 w-36 h-auto opacity-70"
                        />
                        <p className="text-lg font-medium text-[var(--color-welcome-text-main)]">Bem-vindo, aluno!</p>
                        <p className="text-sm max-w-xs text-[var(--color-welcome-text-secondary)] mt-4">
                            {isMobile && showMobileMenuButton
                                ? "Toque no ícone de menu no canto superior esquerdo para ver suas conversas ou iniciar uma nova."
                                : "Crie uma nova conversa ou selecione uma existente no painel à esquerda para começar."
                            }
                        </p>
                    </div>
                ) : showApiKeyMissing ? (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--color-api-key-missing-text)] p-6 text-center">
                        <IoLockClosedOutline size={48} className="mb-4 opacity-70 text-[var(--color-api-key-missing-icon)]" />
                        <p className="text-lg font-medium">Chave de API necessária</p>
                        <p className="text-sm max-w-xs">
                            Configure sua chave do Google Gemini nas <strong>Configurações</strong> para ativar o
                            chat.
                        </p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--color-no-messages-text-main)] p-6 text-center">
                        <IoChatbubblesOutline size={48} className="mb-4 opacity-50 text-[var(--color-no-messages-icon)]" />
                        <p className="text-lg font-medium">Nenhuma mensagem ainda.</p>
                        <p className="text-sm max-w-xs">Envie uma mensagem abaixo para iniciar a conversa.</p>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-5 w-full">
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} message={msg} conversationId={activeConversationId!} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <MessageInput /> {/* Props will be updated in MessageInput file */}
        </main>
    )
}

export default ChatArea
