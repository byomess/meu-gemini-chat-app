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
    onOpenMobileSidebar: () => void
}

const ChatArea: React.FC<ChatAreaProps> = ({ onOpenMobileSidebar }) => {
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
        // Se o scroll for programático, não queremos que seja interpretado como manual
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
            if (chatContainerRef.current && !userManuallyScrolledRef.current) { // Só auto-scrolla se não houve scroll manual recente
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

    // Efeito para detectar INTERAÇÃO do usuário que causa scroll
    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) return

        const setUserScrolledManually = () => {
            userManuallyScrolledRef.current = true
        }

        // Eventos que indicam uma intenção de scroll pelo usuário
        container.addEventListener('wheel', setUserScrolledManually, { passive: true })
        container.addEventListener('touchstart', setUserScrolledManually, { passive: true })
        // Keydown é mais complexo porque precisamos checar teclas específicas
        // e o evento pode ser no document ou input, não só no container.
        // Por simplicidade, focaremos no wheel e touch no container primeiro.
        // Se o scroll por teclado for um problema, podemos adicionar um listener mais global.

        return () => {
            container.removeEventListener('wheel', setUserScrolledManually)
            container.removeEventListener('touchstart', setUserScrolledManually)
        }
    }, [])


    // Efeito para lidar com o evento de SCROLL e atualizar estados
    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) return

        const handleScroll = () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
            scrollTimeoutRef.current = setTimeout(() => {
                if (!chatContainerRef.current) return // Container pode ter sido desmontado

                const currentContainer = chatContainerRef.current
                const threshold = 80
                const atBottom = currentContainer.scrollHeight - currentContainer.scrollTop - currentContainer.clientHeight < threshold

                setIsUserScrolledUp(!atBottom)

                // Se o auto-scroll estiver ativo E o usuário scrollou manualmente para cima
                if (isAutoScrollActive && userManuallyScrolledRef.current && !atBottom) {
                    setIsAutoScrollActive(false)
                }

                // Importante: Resetar o flag APÓS a lógica de decisão
                // para que o próximo scroll programático não seja afetado.
                // Fazemos isso aqui, pois este handleScroll é o consumidor final da informação
                // de "scroll manual" para esta iteração.
                userManuallyScrolledRef.current = false

            }, 60) // Debounce
        }

        container.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll() // Chamada inicial

        return () => {
            container.removeEventListener('scroll', handleScroll)
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
        }
    }, [isAutoScrollActive]) // Depende de isAutoScrollActive para reavaliar a desativação


    // Efeito para scroll inicial e resetar auto-scroll ao mudar de conversa
    useEffect(() => {
        if (isAutoScrollActive) {
            setIsAutoScrollActive(false)
        }
        userManuallyScrolledRef.current = false // Reseta ao mudar de conversa também

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
                        // Só scrolla para o final se o usuário não tiver scrollado manualmente para cima
                        // entre o carregamento da conversa e este timeout.
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
        userManuallyScrolledRef.current = false // Clique no botão não é scroll manual do conteúdo
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
    // O botão só deve aparecer se houver mensagens e não estivermos na tela de boas-vindas/API key
    // E também, só faz sentido se houver conteúdo scrollável ou se o usuário estiver scrollado para cima.
    // A lógica de `isUserScrolledUp` OU `isAutoScrollActive` define se o botão é necessário.
    // Se não estiver scrollado pra cima e o auto scroll estiver desligado, não precisa do botão para "ir para o fim".
    // Mas o botão AGORA também ATIVA o auto-scroll, então ele deve aparecer se há mensagens.
    const showFloatingButton = !showWelcome && !showApiKeyMissing && messages.length > 0;


    return (
        <main className="
        flex flex-col h-screen relative text-slate-100
        bg-slate-950 bg-gradient-to-b from-slate-950 to-slate-900
      ">

            <div className="
          sticky top-0 z-20
          flex items-center gap-3
          px-4 py-3
          backdrop-blur
          bg-slate-800/60
          border-b border-slate-700/50
          shadow-md
        ">
                {isMobile && (
                    <button
                        onClick={onOpenMobileSidebar}
                        className="p-1 text-slate-300 hover:text-white"
                        title="Abrir menu"
                        aria-label="Abrir menu"
                    >
                        <IoMenuOutline size={24} />
                    </button>
                )}

                <IoChatbubblesOutline size={22} className="flex-shrink-0 text-slate-400" />
                <h2 className="truncate text-base sm:text-lg font-semibold">{conversationTitle}</h2>
            </div>

            {showFloatingButton && (
                <button
                    onClick={handleFloatingButtonClick}
                    className={`
                        fixed bottom-24 right-6 sm:right-8 z-30
                        p-3 rounded-full
                        shadow-lg shadow-indigo-800/40
                        text-white
                        hover:scale-105 active:scale-95
                        transition-all duration-150 ease-in-out
                        ${isAutoScrollActive
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                            : 'bg-gradient-to-br from-cyan-500 to-indigo-600'}
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
                className="
          flex-1 overflow-y-auto
          px-3 md:px-4 py-4 md:py-6
          scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600
        "
            >
                {showWelcome ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                        <img
                            src="/logo-loox.png"
                            alt="Logo Loox"
                            className="py-4 w-36 h-auto opacity-40 loox-logo-blue"
                        />
                        <p className="text-lg font-medium text-slate-500">Faaala Felipão!</p>
                        <p className="text-sm max-w-xs text-slate-600 mt-4">
                            {isMobile
                                ? "Toque no ícone de menu no canto superior esquerdo para ver suas conversas ou iniciar uma nova."
                                : "Crie uma nova conversa ou selecione uma existente no painel à esquerda para começar."
                            }
                        </p>
                    </div>
                ) : showApiKeyMissing ? (
                    <div className="h-full flex flex-col items-center justify-center text-yellow-400 p-6 text-center">
                        <IoLockClosedOutline size={48} className="mb-4 opacity-70" />
                        <p className="text-lg font-medium">Chave de API necessária</p>
                        <p className="text-sm max-w-xs">
                            Configure sua chave do Google Gemini nas <strong>Configurações</strong> para ativar o
                            chat.
                        </p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                        <IoChatbubblesOutline size={48} className="mb-4 opacity-40" />
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

            <MessageInput />
        </main>
    )
}

export default ChatArea
