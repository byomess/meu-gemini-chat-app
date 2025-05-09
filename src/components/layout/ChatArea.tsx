import React, { useEffect, useRef, useState } from 'react'
import MessageInput from '../chat/MessageInput'
import MessageBubble from '../chat/MessageBubble'
import { useConversations } from '../../contexts/ConversationContext'
import {
    IoChatbubblesOutline,
    IoSparklesOutline,
    IoLockClosedOutline,
    IoArrowDownCircleOutline,
} from 'react-icons/io5'
import { useAppSettings } from '../../contexts/AppSettingsContext'

const ChatArea: React.FC = () => {
    const { activeConversation, activeConversationId, isProcessingEditedMessage } =
        useConversations()
    const { settings } = useAppSettings()

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
    const [forceScrollDown, setForceScrollDown] = useState(false)

    const messages = activeConversation?.messages || []
    const conversationTitle = activeConversation?.title || 'Chat'

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
        setIsUserScrolledUp(false)
        setForceScrollDown(false)
    }

    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) return
        const threshold = 200
        const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight <
            threshold
        if (forceScrollDown || (isNearBottom && !isUserScrolledUp)) {
            scrollToBottom()
        }
    }, [messages, isProcessingEditedMessage, forceScrollDown])

    useEffect(() => {
        const container = chatContainerRef.current
        if (!container) return
        const handleScroll = () => {
            const threshold = 50
            const isAtBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight <
                threshold
            setIsUserScrolledUp(!isAtBottom)
        }
        container.addEventListener('scroll', handleScroll, { passive: true })
        return () => {
            container.removeEventListener('scroll', handleScroll)
        }
    }, [])

    useEffect(() => {
        if (activeConversationId) {
            setTimeout(() => scrollToBottom('auto'), 0)
            setIsUserScrolledUp(false)
        }
    }, [activeConversationId])

    const showWelcomeMessage = !activeConversationId
    const showApiKeyMissingMessage = activeConversationId && !settings.apiKey

    return (
        <main className="flex-1 flex flex-col bg-slate-900 text-slate-100 h-screen overflow-hidden relative">
            <div className="p-3 sm:p-4 border-b border-slate-700/80 flex items-center space-x-3 sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md">
                <IoChatbubblesOutline
                    size={22}
                    className="text-slate-400 flex-shrink-0"
                />
                <h2
                    className="text-base sm:text-lg font-semibold truncate"
                    title={conversationTitle}
                >
                    {conversationTitle}
                </h2>
            </div>

            {isUserScrolledUp && messages.length > 0 && (
                <button
                    onClick={() => setForceScrollDown(true)}
                    className="absolute bottom-20 right-6 sm:right-8 z-10 p-2.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-transform hover:scale-105"
                    title="Rolar para as mensagens mais recentes"
                    aria-label="Rolar para as mensagens mais recentes"
                >
                    <IoArrowDownCircleOutline size={24} />
                </button>
            )}

            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 scrollbar-track-transparent"
            >
                {showWelcomeMessage ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                        <IoSparklesOutline size={50} className="mb-4 opacity-40" />
                        <p className="text-lg font-medium">Bem-vindo à Interface Gemini!</p>
                        <p className="text-sm max-w-xs">
                            Crie uma nova conversa ou selecione uma existente no painel à
                            esquerda para começar.
                        </p>
                    </div>
                ) : showApiKeyMissingMessage ? (
                    <div className="h-full flex flex-col items-center justify-center text-yellow-400/90 p-6 text-center">
                        <IoLockClosedOutline size={50} className="mb-4 opacity-60" />
                        <p className="text-lg font-medium">Chave de API Necessária</p>
                        <p className="text-sm max-w-xs">
                            Por favor, configure sua chave de API do Google Gemini nas{' '}
                            <strong className="font-semibold">Configurações</strong> para
                            ativar o chat.
                        </p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                        <IoChatbubblesOutline size={50} className="mb-4 opacity-40" />
                        <p className="text-lg font-medium">Nenhuma mensagem ainda.</p>
                        <p className="text-sm max-w-xs">
                            Envie uma mensagem abaixo para iniciar esta conversa.
                        </p>
                    </div>
                ) : (
                    <div className="px-1 sm:px-2 md:px-3 py-3 sm:py-4 md:py-6 space-y-4 sm:space-y-5 w-full">
                        {messages.map(msg => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                conversationId={activeConversationId!}
                            />
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
