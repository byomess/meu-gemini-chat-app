// src/components/chat/MessageBubble.tsx
import type { Message } from '../../types';
import { IoPersonCircleOutline, IoSparklesOutline, IoGitNetworkOutline } from 'react-icons/io5'; // Adicionar IoGitNetworkOutline

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isLoading = message.metadata?.isLoading;
  const hasMemorizedItems = message.metadata?.memorizedItems && message.metadata.memorizedItems.length > 0;

  return (
    <div className="flex flex-col">
      {/* Indicador de memória para mensagens da IA */}
      {!isUser && hasMemorizedItems && (
        <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1 ml-10 animate-fadeInQuick">
          <IoGitNetworkOutline />
          <span>Memória atualizada</span>
          {/* Tooltip opcional com as memórias:
          <span className="relative group">
            ({message.metadata?.memorizedItems?.length})
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-slate-600 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {message.metadata?.memorizedItems?.join('; ')}
            </span>
          </span>
          */}
        </div>
      )}

      <div className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md">
            <IoSparklesOutline size={18} />
          </div>
        )}
        <div
          className={`max-w-[85%] sm:max-w-xl lg:max-w-2xl p-3 sm:p-3.5 rounded-xl sm:rounded-2xl shadow
            ${isUser
              ? 'bg-blue-600 text-white rounded-br-lg sm:rounded-br-xl'
              : 'bg-slate-700 text-slate-100 rounded-bl-lg sm:rounded-bl-xl'
            }
            ${isLoading ? 'opacity-70 animate-pulseSlow' : ''}
          `}
        >
          {/* Renderiza um cursor simples se estiver carregando e não houver texto ainda */}
          {isLoading && !message.text && <span className="inline-block animate-pulseSlow text-transparent">▍</span>}
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.text}
            {/* Se não usar o cursor no texto, pode usar um spinner aqui durante o isLoading */}
          </p>
        </div>
        {isUser && (
          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 shadow-md">
            <IoPersonCircleOutline size={20} />
          </div>
        )}
      </div>
      {/* Adicionar animação no CSS global ou tailwind.config.js */}
      <style>{`
        @keyframes fadeInQuick {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInQuick { animation: fadeInQuick 0.3s ease-out forwards; }

        @keyframes pulseSlow {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        .animate-pulseSlow { animation: pulseSlow 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
};

export default MessageBubble;