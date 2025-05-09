// src/components/chat/MessageBubble.tsx
import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '../../types';
import {
  IoPersonCircleOutline,
  IoSparklesOutline,
  IoGitNetworkOutline,
  IoTrashOutline,
  IoPencilOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoSyncOutline, // Ícone para indicar processamento da edição
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';

interface MessageBubbleProps {
  message: Message;
  conversationId: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, conversationId }) => {
  const {
    removeMessageById,
    updateMessageInConversation,
    regenerateResponseForEditedMessage,
    isProcessingEditedMessage,
    activeConversation, // Precisamos para a heurística do indicador de loading da edição
  } = useConversations();

  const isUser = message.sender === 'user';
  const isLoading = message.metadata?.isLoading;
  const isError = message.metadata?.error;
  const hasMemorizedItems = message.metadata?.memorizedItems && message.metadata.memorizedItems.length > 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.text);
  const [showActions, setShowActions] = useState(false);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustEditareaHeight = () => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.style.height = 'auto';
      const maxHeight = 200;
      editTextareaRef.current.style.height = `${Math.min(editTextareaRef.current.scrollHeight, maxHeight)}px`;
      editTextareaRef.current.style.overflowY = editTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  };

  useEffect(() => {
    adjustEditareaHeight();
  }, [isEditing, editedText]);

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      const len = editTextareaRef.current.value.length;
      editTextareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir esta mensagem?`)) {
      removeMessageById(conversationId, message.id);
    }
  };

  const handleEdit = () => {
    setEditedText(message.text);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const newText = editedText.trim();
    setIsEditing(false);

    if (newText === message.text || newText === "") {
      if (newText === "" && message.text !== "") {
        if (window.confirm("O texto está vazio. Deseja excluir a mensagem?")) {
          removeMessageById(conversationId, message.id);
        }
      }
      return;
    }

    if (isUser) {
      await regenerateResponseForEditedMessage(conversationId, message.id, newText);
    } else {
      updateMessageInConversation(conversationId, message.id, { text: newText });
    }
  };

  const handleCancelEdit = () => {
    setEditedText(message.text);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };
  
  // Verifica se esta mensagem específica (do usuário) é a que está atualmente causando o reprocessamento.
  // Esta heurística assume que a mensagem do usuário é atualizada primeiro, e depois as mensagens da IA são removidas/adicionadas.
  // E que apenas uma edição é processada por vez.
  const isThisUserMessageBeingReprocessed =
    isUser &&
    isProcessingEditedMessage &&
    activeConversation?.messages.some(m => m.id === message.id && m.text === message.text) && // A mensagem ainda existe com o texto original (antes da IA responder à edição)
    activeConversation?.messages[activeConversation.messages.length -1]?.metadata?.isLoading && // A última mensagem é um placeholder da IA
    activeConversation?.messages.findIndex(m => m.id === message.id) < (activeConversation.messages.length -1) ; // Não é a última mensagem (ainda)


  const canPerformActions = !isLoading && !isError && !isProcessingEditedMessage && !isThisUserMessageBeingReprocessed;

  const editTextareaBaseClasses = "w-full p-2.5 text-sm text-white focus:outline-none resize-none rounded-lg scrollbar-thin";
  const editTextareaUserClasses = `${editTextareaBaseClasses} bg-blue-700 scrollbar-thumb-blue-500 scrollbar-track-blue-600`;
  const editTextareaAIClasses = `${editTextareaBaseClasses} bg-slate-600 scrollbar-thumb-slate-400 scrollbar-track-slate-500`;

  const editControlsUserClasses = "text-blue-200 hover:text-white hover:bg-blue-500/50";
  const editControlsAIClasses = "text-slate-300 hover:text-white hover:bg-slate-500/50";

  return (
    <div
      className="group relative flex flex-col mb-1"
      onMouseEnter={() => canPerformActions && setShowActions(true)}
      onMouseLeave={() => canPerformActions && setShowActions(false)} // Não oculta se estiver editando
    >
      {!isUser && hasMemorizedItems && (
        <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1 ml-10 animate-fadeInQuick">
          <IoGitNetworkOutline />
          <span>Memória atualizada</span>
        </div>
      )}

      <div className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md mt-px">
            <IoSparklesOutline size={18} />
          </div>
        )}

        <div
          className={`relative max-w-[85%] sm:max-w-xl lg:max-w-2xl 
            ${isEditing && !isThisUserMessageBeingReprocessed ? 'w-full' : ''}
            ${isUser ? 'order-1' : ''} 
            `}
        >
          {isEditing && !isThisUserMessageBeingReprocessed ? ( 
            <div className={`p-1 rounded-xl shadow-md ${isUser ? 'bg-blue-700' : 'bg-slate-600'}`}>
              <textarea
                ref={editTextareaRef}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className={isUser ? editTextareaUserClasses : editTextareaAIClasses}
                rows={1}
                aria-label="Editar mensagem"
              />
              <div className="flex justify-end gap-2 mt-1.5 px-1.5 pb-0.5">
                <button
                  onClick={handleCancelEdit}
                  className={`p-1 rounded ${isUser ? editControlsUserClasses : editControlsAIClasses}`}
                  title="Cancelar edição (Esc)"
                >
                  <IoCloseOutline size={18} />
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={`p-1 rounded ${isUser ? editControlsUserClasses : editControlsAIClasses}`}
                  title="Salvar edição (Enter)"
                  disabled={editedText.trim() === "" && message.text === ""}
                >
                  <IoCheckmarkOutline size={18} />
                </button>
              </div>
            </div>
          ) : ( 
            <div
              className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl shadow relative
                ${isUser
                  ? 'bg-blue-600 text-white rounded-br-lg sm:rounded-br-xl'
                  : `bg-slate-700 text-slate-100 rounded-bl-lg sm:rounded-bl-xl ${isError ? '!bg-red-800/90 !border !border-red-600' : ''}`
                }
                ${(isLoading || isThisUserMessageBeingReprocessed) ? 'opacity-70 animate-pulseSlow' : ''}
              `}
            >
              {/* Indicador de reprocessamento para mensagem do usuário */}
              {isThisUserMessageBeingReprocessed &&
                <div className="absolute -top-1.5 -right-1.5 p-0.5 bg-slate-600 rounded-full shadow z-10">
                    <IoSyncOutline size={12} className="text-slate-300 animate-spin" />
                </div>
              }

              {(isLoading) && !message.text && <span className="inline-block animate-pulseSlow text-transparent">▍</span>}
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.text || (isLoading ? "" : "...")}
              </p>
            </div>
          )}
        </div>

        {isUser && (
          <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 shadow-md mt-px ${isEditing ? 'self-start' : ''}`}>
            <IoPersonCircleOutline size={20} />
          </div>
        )}

        {canPerformActions && showActions && !isEditing && (
            <div className={`flex items-center rounded-full shadow-lg bg-slate-750 border border-slate-600/50 p-0.5
                            absolute top-[-10px] transform -translate-y-1/2 transition-all duration-200 ease-out z-20 
                            ${isUser ? 'right-8' : 'left-8'}
                            ${showActions ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}
                          `}>
              <button
                onClick={handleEdit}
                className="p-1.5 text-slate-300 hover:text-blue-400 hover:bg-slate-600/70 rounded-full"
                title="Editar mensagem"
                disabled={isProcessingEditedMessage}
              >
                <IoPencilOutline size={14} />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-slate-600/70 rounded-full"
                title="Excluir mensagem"
                disabled={isProcessingEditedMessage}
              >
                <IoTrashOutline size={14} />
              </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;