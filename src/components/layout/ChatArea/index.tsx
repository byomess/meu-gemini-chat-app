import {
    IoArrowDownCircleOutline,
} from 'react-icons/io5'
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

interface ChatAreaProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean;
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
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

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

            <ChatHeader
                onOpenMobileSidebar={onOpenMobileSidebar}
                showMobileMenuButton={showMobileMenuButton}
                isIncognito={isIncognito}
                conversationTitle={conversationTitle}
                googleDriveSyncStatus={settings.googleDriveSyncStatus}
            />

            <ScrollToBottomButton
                isVisible={showFloatingButton}
                onClick={scrollToBottom}
            />

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
                ) : messages.length === 0 ? (
                    <NoMessagesDisplay />
                ) : (
                    <div className="space-y-4 sm:space-y-5 w-full">
                        {messages.map(msg => (
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
