/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/ChatArea/ChatArea.tsx
import {
    IoChatbubblesOutline,
    IoArrowDownCircleOutline,
    IoLockClosedOutline,
    IoMenuOutline,
    IoCheckmarkCircleOutline, // Ícone para auto-scroll ativado
} from 'react-icons/io5'
import MessageInput from '../chat/MessageInput'
import MessageBubble from '../chat/MessageBubble'
import { useConversations } from '../../contexts/ConversationContext'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import useIsMobile from '../../hooks/useIsMobile'
import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'

const AUTO_SCROLL_INTERVAL = 500;

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
    const userManuallyScrolledRef = useRef(false) // Flag para detectar scroll manual
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Para debounce do scroll

    const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
    const [isAutoScrollActive, setIsAutoScrollActive] = useState(false)
    const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const messages = activeConversation?.messages || []
    const conversationTitle = activeConversation?.title || 'Chat'

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        userManuallyScrolledRef.current = false
        messagesEndRef.current?.scrollIntoView({ behavior })
    }, [])

    const stopAutoScrollInterval = useCallback(() => {
        if (autoScrollIntervalRef.current) {
            clearInterval(autoScrollIntervalRef.current)
            autoScrollIntervalRef.current = null
        }
    }, [])

    const startAutoScrollInterval = useCallback(() => {
        stopAutoScrollInterval()
        autoScrollIntervalRef.current = setInterval(() => {
            if (chatContainerRef.current && !userManuallyScrolledRef.current) { 
                const container = chatContainerRef.current
                const threshold = 10
                const atBottom =
                    container.scrollHeight -
                    container.scrollTop -
                    container.clientHeight <
                    threshold
                if (!atBottom) {
                    scrollToBottom('smooth')
                }
            }
        }, AUTO_SCROLL_INTERVAL);
    }, [scrollToBottom, stopAutoScrollInterval])

    useEffect(() => {
        if (isAutoScrollActive) {
            startAutoScrollInterval()
        } else {
            stopAutoScrollInterval()
        }
        return () => {
            stopAutoScrollInterval()
        }
    }, [isAutoScrollActive, startAutoScrollInterval, stopAutoScrollInterval])

    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) return

        const setUserScrolledManually = () => {
            userManuallyScrolledRef.current = true
        }

        container.addEventListener('wheel', setUserScrolledManually, { passive: true })
        container.addEventListener('touchstart', setUserScrolledManually, { passive: true })
        
        return () => {
            container.removeEventListener('wheel', setUserScrolledManually)
            container.removeEventListener('touchstart', setUserScrolledManually)
        }
    }, [])


    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) return

        const handleScroll = () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
            scrollTimeoutRef.current = setTimeout(() => {
                if (!chatContainerRef.current) return 

                const currentContainer = chatContainerRef.current
                const threshold = 80
                const atBottom = currentContainer.scrollHeight - currentContainer.scrollTop - currentContainer.clientHeight < threshold

                setIsUserScrolledUp(!atBottom)

                if (isAutoScrollActive && userManuallyScrolledRef.current && !atBottom) {
                    setIsAutoScrollActive(false)
                }
                userManuallyScrolledRef.current = false

            }, 60) 
        }

        container.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll() 

        return () => {
            container.removeEventListener('scroll', handleScroll)
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
        }
    }, [isAutoScrollActive]) 


    useEffect(() => {
        if (isAutoScrollActive) {
            setIsAutoScrollActive(false)
        }
        userManuallyScrolledRef.current = false 

        const container = chatContainerRef.current
        if (!container) {
            if (!activeConversationId) setIsUserScrolledUp(false)
            return
        }

        if (activeConversationId) {
            const isNewConversationJustLoadedAndAtTop = messages.length > 0 && container.scrollTop < 50

            if (isNewConversationJustLoadedAndAtTop) {
                setTimeout(() => {
                    if (chatContainerRef.current) {
                        const currentContainer = chatContainerRef.current
                        if (!userManuallyScrolledRef.current) {
                            const stillNearTop = currentContainer.scrollTop < currentContainer.clientHeight / 2
                            if (stillNearTop) {
                                scrollToBottom('auto')
                            }
                        }
                        const atBottomAfterPossibleScroll = currentContainer.scrollHeight - currentContainer.scrollTop - currentContainer.clientHeight < 5
                        setIsUserScrolledUp(!atBottomAfterPossibleScroll)
                    }
                }, 50)
            } else {
                const threshold = 80
                const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
                setIsUserScrolledUp(!atBottom)
            }
        } else {
            setIsUserScrolledUp(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeConversationId, messages.length, scrollToBottom])


    const handleFloatingButtonClick = () => {
        userManuallyScrolledRef.current = false 
        if (isAutoScrollActive) {
            setIsAutoScrollActive(false)
            if (chatContainerRef.current) {
                const container = chatContainerRef.current;
                const threshold = 80;
                const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
                setIsUserScrolledUp(!atBottom);
            }
        } else {
            scrollToBottom('auto')
            setIsUserScrolledUp(false)
            setIsAutoScrollActive(true)
        }
    }

    const showWelcome = !activeConversationId
    const showApiKeyMissing = activeConversationId && !settings.apiKey
    const showFloatingButton = !showWelcome && !showApiKeyMissing && messages.length > 0;


    return (
        <main className="flex flex-col h-screen relative text-gray-800 bg-gray-100">

            <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-md bg-white/80 border-b border-gray-200 shadow-sm">
                {isMobile && showMobileMenuButton && (
                    <button
                        onClick={onOpenMobileSidebar}
                        className="p-1 text-gray-600 hover:text-gray-900"
                        title="Abrir menu"
                        aria-label="Abrir menu"
                    >
                        <IoMenuOutline size={24} />
                    </button>
                )}

                <IoChatbubblesOutline size={22} className="flex-shrink-0 text-gray-500" />
                <h2 className="truncate text-base sm:text-lg font-semibold text-gray-800">{conversationTitle}</h2>
            </div>

            {showFloatingButton && (
                <button
                    onClick={handleFloatingButtonClick}
                    className={`
                        fixed bottom-24 right-6 sm:right-8 z-30
                        p-3 rounded-full
                        shadow-lg shadow-[#e04579]/30
                        text-white
                        hover:scale-105 active:scale-95
                        transition-all duration-150 ease-in-out
                        ${isAutoScrollActive
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                            : 'bg-gradient-to-br from-[#e04579] to-[#c73d6a]'
                        }
                    `}
                    title={isAutoScrollActive
                        ? "Desativar rolagem automática"
                        : (isUserScrolledUp ? "Rolar para o fim e ativar rolagem automática" : "Ativar rolagem automática")}
                    aria-label={isAutoScrollActive
                        ? "Desativar rolagem automática"
                        : (isUserScrolledUp ? "Rolar para o fim e ativar rolagem automática" : "Ativar rolagem automática")}
                >
                    {isAutoScrollActive
                        ? <IoCheckmarkCircleOutline size={24} />
                        : <IoArrowDownCircleOutline size={24} />}
                </button>
            )}

            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-3 md:px-4 py-4 md:py-6" // Scrollbar styling will be from global CSS or browser default
            >
                {showWelcome ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6 text-center">
                        <img
                            src="/logo-aulapp.svg"
                            alt="Logo Loox"
                            className="py-4 w-36 h-auto opacity-70"
                        />
                        <p className="text-lg font-medium text-gray-600">Bem-vindo, aluno!</p>
                        <p className="text-sm max-w-xs text-gray-500 mt-4">
                            {isMobile && showMobileMenuButton
                                ? "Toque no ícone de menu no canto superior esquerdo para ver suas conversas ou iniciar uma nova."
                                : "Crie uma nova conversa ou selecione uma existente no painel à esquerda para começar."
                            }
                        </p>
                    </div>
                ) : showApiKeyMissing ? (
                    <div className="h-full flex flex-col items-center justify-center text-orange-600 p-6 text-center">
                        <IoLockClosedOutline size={48} className="mb-4 opacity-70" />
                        <p className="text-lg font-medium">Chave de API necessária</p>
                        <p className="text-sm max-w-xs">
                            Configure sua chave do Google Gemini nas <strong>Configurações</strong> para ativar o
                            chat.
                        </p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6 text-center">
                        <IoChatbubblesOutline size={48} className="mb-4 opacity-50" />
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
