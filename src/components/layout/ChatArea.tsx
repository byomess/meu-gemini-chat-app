// src/components/layout/ChatArea.tsx
import React, { useEffect, useRef } from 'react'; // Adicionar useEffect e useRef
import MessageInput from '../chat/MessageInput';
import MessageBubble from '../chat/MessageBubble';
import { useConversations } from '../../contexts/ConversationContext'; // Importar o hook
import { IoChatbubblesOutline, IoSparklesOutline, IoLockClosedOutline } from 'react-icons/io5'; // Adicionar IoLockClosedOutline
import { useAppSettings } from '../../contexts/AppSettingsContext'; // Para verificar a API Key

const ChatArea: React.FC = () => {
    const { activeConversation, activeConversationId } = useConversations();
    const { settings } = useAppSettings(); // Para a mensagem sobre API Key
    const messagesEndRef = useRef<HTMLDivElement>(null); // Para auto-scroll

    const messages = activeConversation?.messages || [];
    const conversationTitle = activeConversation?.title || 'Chat';

    // Auto-scroll para a última mensagem
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]); // Sempre que as mensagens mudarem

    const showWelcomeMessage = !activeConversationId;
    const showApiKeyMissingMessage = activeConversationId && !settings.apiKey;

    return (
        <main className="flex-1 flex flex-col bg-slate-900 text-slate-100 h-screen overflow-hidden"> {/* overflow-hidden aqui para controlar o scroll interno */}
            <div className="p-3 sm:p-4 border-b border-slate-700/80 flex items-center space-x-3 sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md">
                <IoChatbubblesOutline size={22} className="text-slate-400 flex-shrink-0" />
                <h2 className="text-base sm:text-lg font-semibold truncate" title={conversationTitle}>
                    {conversationTitle}
                </h2>
                {/* Futuramente, pode adicionar um contador de mensagens ou outras informações aqui */}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 scrollbar-track-transparent">
                {showWelcomeMessage ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                        <IoSparklesOutline size={50} className="mb-4 opacity-40" />
                        <p className="text-lg font-medium">Bem-vindo à Interface Gemini!</p>
                        <p className="text-sm max-w-xs">
                            Crie uma nova conversa ou selecione uma existente no painel à esquerda para começar.
                        </p>
                    </div>
                ) : showApiKeyMissingMessage ? (
                    <div className="h-full flex flex-col items-center justify-center text-yellow-400/90 p-6 text-center">
                        <IoLockClosedOutline size={50} className="mb-4 opacity-60" />
                        <p className="text-lg font-medium">Chave de API Necessária</p>
                        <p className="text-sm max-w-xs">
                            Por favor, configure sua chave de API do Google Gemini nas <strong className="font-semibold">Configurações</strong> para ativar o chat.
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
                    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5">
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                conversationId={activeConversationId!} // Passar o ID da conversa ativa
                            />
                        ))}
                        <div ref={messagesEndRef} /> {/* Elemento invisível para o auto-scroll */}
                    </div>
                )}
            </div>
            <MessageInput />
        </main>
    );
};

export default ChatArea;