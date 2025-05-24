/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/ChatArea/ChatArea.tsx
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
import { useCallback, useEffect, useRef } from 'react'
import React from 'react'

interface ChatAreaProps {
    onOpenMobileSidebar: () => void;
    showMobileMenuButton: boolean; // New prop
}

const ChatArea: React.FC<ChatAreaProps> = ({ onOpenMobileSidebar, showMobileMenuButton }) => {
    const {
        activeConversation,
        activeConversationId,
        // isGeneratingResponse // Poderia ser usado para refinar ainda mais, se necessário
    } = useConversations()
    const { settings } = useAppSettings()
    const isMobile = useIsMobile()

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const messages = activeConversation?.messages || []
    const conversationTitle = activeConversation?.title || 'Chat'

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }, [])

    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) {
            return
        }

        if (activeConversationId) {
            const isNewConversationJustLoadedAndAtTop = messages.length > 0 && container.scrollTop < 50

            if (isNewConversationJustLoadedAndAtTop) {
                setTimeout(() => {
                    if (chatContainerRef.current) {
                        const currentContainer = chatContainerRef.current
                        const stillNearTop = currentContainer.scrollTop < currentContainer.clientHeight / 2
                        if (stillNearTop) {
                            scrollToBottom('auto')
                        }
                    }
                }, 50)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeConversationId, messages.length, scrollToBottom])


    const handleFloatingButtonClick = () => {
        scrollToBottom('auto')
    }

    const showWelcome = !activeConversationId
    const showApiKeyMissing = activeConversationId && !settings.apiKey
    const showFloatingButton = !showWelcome && !showApiKeyMissing && messages.length > 0;

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
                <h2 className="truncate text-base sm:text-lg font-semibold text-[var(--color-chat-header-title)]">{conversationTitle}</h2>
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
