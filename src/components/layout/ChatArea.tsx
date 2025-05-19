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
import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'

interface ChatAreaProps {
    onOpenMobileSidebar: () => void
}

const ChatArea: React.FC<ChatAreaProps> = ({ onOpenMobileSidebar }) => {
    const {
        activeConversation,
        activeConversationId,
        // isGeneratingResponse // Não é mais usado diretamente para auto-scroll
    } = useConversations()
    const { settings } = useAppSettings()
    const isMobile = useIsMobile()

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
    // const [userHasManuallyScrolledUp, setUserHasManuallyScrolledUp] = useState(false) // Não é mais necessário

    const messages = activeConversation?.messages || []
    const conversationTitle = activeConversation?.title || 'Chat'

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }, [])

    // REMOVIDO: useEffect para auto-scroll durante a geração de resposta
    // useEffect(() => {
    //     if (isGeneratingResponse && !userHasManuallyScrolledUp && chatContainerRef.current) {
    //         scrollToBottom('auto')
    //     }
    // }, [activeConversation?.messages, isGeneratingResponse, userHasManuallyScrolledUp, scrollToBottom])

    // Mantido: useEffect para detectar scroll manual do usuário e mostrar/esconder o botão
    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) return

        let scrollDebounceTimer: NodeJS.Timeout

        const handleScroll = () => {
            clearTimeout(scrollDebounceTimer)
            scrollDebounceTimer = setTimeout(() => {
                if (!chatContainerRef.current) return
                const currentContainer = chatContainerRef.current
                const threshold = 80; // Quão longe do fundo para considerar que o usuário rolou para cima
                
                const atBottom = currentContainer.scrollHeight - currentContainer.scrollTop - currentContainer.clientHeight < threshold

                setIsUserScrolledUp(!atBottom)

                // A lógica de userHasManuallyScrolledUp não é mais necessária aqui
                // pois não estamos mais fazendo auto-scroll baseado nisso.
            }, 60)
        }

        container.addEventListener('scroll', handleScroll, { passive: true })
        
        // Verifica a posição inicial do scroll para o botão
        handleScroll()

        return () => {
            container.removeEventListener('scroll', handleScroll)
            clearTimeout(scrollDebounceTimer)
        }
    }, []) // Dependência de isGeneratingResponse removida pois não afeta mais esta lógica diretamente

    // REMOVIDO: useEffect para auto-scroll ao mudar de conversa
    // (a menos que você queira um scroll inicial para o fundo ao abrir uma conversa pela primeira vez,
    // nesse caso, ele pode ser adaptado)
    // Se você quiser que ao abrir a conversa ele vá para o final automaticamente UMA VEZ:
    useEffect(() => {
        if (activeConversationId && chatContainerRef.current) {
             // Verifica se a conversa acabou de carregar e está vazia ou se o scroll está no topo
             const container = chatContainerRef.current;
             const isNewConversationJustLoaded = messages.length > 0 && container.scrollTop === 0;
             const isNearTopAndNotEmpty = messages.length > 0 && container.scrollTop < container.clientHeight / 2;


            if (isNewConversationJustLoaded || isNearTopAndNotEmpty) {
                setTimeout(() => {
                     // Rola para o final apenas se não estiver já lá
                    const isCurrentlyAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
                    if (!isCurrentlyAtBottom) {
                        scrollToBottom('auto');
                    }
                     // Atualiza o estado do botão após o scroll
                    const atBottomAfterScroll = container.scrollHeight - container.scrollTop - container.clientHeight < 5;
                    setIsUserScrolledUp(!atBottomAfterScroll);
                }, 50);
            } else {
                // Se a conversa já estava aberta e rolada, apenas verifica a posição para o botão
                const threshold = 80;
                const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
                setIsUserScrolledUp(!atBottom);
            }
        }
    }, [activeConversationId, messages.length, scrollToBottom]);


    const handleScrollToBottomButtonClick = () => {
        scrollToBottom('smooth')
        // setUserHasManuallyScrolledUp(false) // Não é mais necessário
        setIsUserScrolledUp(false) // Esconde o botão imediatamente
    }

    const showWelcome = !activeConversationId
    const showApiKeyMissing = activeConversationId && !settings.apiKey

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

            {isUserScrolledUp && messages.length > 0 && (
                <button
                    onClick={handleScrollToBottomButtonClick}
                    className="
            fixed bottom-24 right-6 sm:right-8 z-30
            p-3 rounded-full
            bg-gradient-to-br from-cyan-500 to-indigo-600
            shadow-lg shadow-indigo-800/40
            text-white
            hover:scale-105 active:scale-95
            transition-transform
          "
                    title="Rolar para o fim"
                    aria-label="Rolar para o fim"
                >
                    <IoArrowDownCircleOutline size={24} />
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
                        <p className="text-lg font-medium text-slate-500">Bem-vindo, usuário!</p>
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
                    <div className="space-y-4 sm:space-y-5">
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