// src/components/layout/Sidebar.tsx
import React, { useState, useCallback } from 'react';
import Button from '../common/Button';
import {
  IoSettingsOutline,
  IoAddCircleOutline,
  IoChatbubbleEllipsesOutline,
  IoTrashBinOutline,
  IoPencilOutline,
  IoCloseOutline,
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import type { Conversation } from '../../types';

interface SidebarProps {
  onOpenSettings: () => void;
  isMobile: boolean; // Mudado para não opcional, já que App.tsx sempre define
  isOpen?: boolean; // Para controlar a visibilidade/transição no mobile
  onCloseMobile?: () => void;
  onSelectConversation?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    onOpenSettings,
    isMobile,
    isOpen,
    onCloseMobile,
    onSelectConversation
}) => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createNewConversation,
    deleteConversation,
    updateConversationTitle,
  } = useConversations();

  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>('');

  const sortedConversations = [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleDeleteConversation = useCallback((e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.')) {
      deleteConversation(conversationId);
    }
  }, [deleteConversation]);

  const handleStartEditTitle = useCallback((e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    setEditingConversationId(conversation.id);
    setTempTitle(conversation.title);
  }, []);

  const handleSaveTitle = useCallback((conversationId: string) => {
    if (tempTitle.trim() && editingConversationId === conversationId) {
      updateConversationTitle(conversationId, tempTitle.trim());
    }
    setEditingConversationId(null);
    setTempTitle('');
  }, [tempTitle, editingConversationId, updateConversationTitle]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTitle(e.target.value);
  }, []);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, conversationId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle(conversationId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingConversationId(null);
      setTempTitle('');
    }
  }, [handleSaveTitle]);

  const handleSelectConvo = useCallback((convoId: string) => {
    setActiveConversationId(convoId);
    if (isMobile && onSelectConversation) {
        onSelectConversation();
    }
  }, [setActiveConversationId, isMobile, onSelectConversation]);

  const baseClasses = `bg-slate-950 text-slate-200 h-screen flex flex-col p-3 transition-transform duration-300 ease-in-out`;
  
  const desktopSpecificClasses = `w-60 md:w-72 border-r border-slate-800 relative`;
  
  const mobileSpecificClasses = `fixed inset-y-0 left-0 w-3/4 max-w-xs z-50 shadow-lg border-r border-slate-800 
                                 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

  const finalAsideClasses = isMobile 
    ? `${baseClasses} ${mobileSpecificClasses}` 
    : `${baseClasses} ${desktopSpecificClasses}`;

  if (isMobile && !isOpen && !document.body.classList.contains('mobile-sidebar-open-transitioning')) {
     // Se for mobile e não estiver aberto (e não estiver em transição de fechamento), não renderiza nada para evitar flashes.
     // A classe 'mobile-sidebar-open-transitioning' seria gerenciada pelo App.tsx para permitir a animação de saída.
     // Por ora, vamos manter a lógica de renderização condicional no App.tsx para o Sidebar mobile.
     // Esta verificação aqui é mais para o caso de querer controlar a transição SÓ com CSS.
     // A forma como App.tsx está agora (renderizando condicionalmente o Sidebar mobile) é mais simples.
  }


  return (
    <aside className={finalAsideClasses}>
      {isMobile && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-100 rounded-md z-[51]"
            title="Fechar menu"
            aria-label="Fechar menu"
          >
            <IoCloseOutline size={24} />
          </button>
      )}

      <div className={`${isMobile ? 'mt-8' : 'mt-2'}`}>
        <Button
          variant="primary"
          className={`w-full !py-2 flex items-center justify-center space-x-2 rounded-lg
                      text-sm font-medium shadow-sm hover:shadow-md
                      transition-all duration-200 ease-in-out group/newConvo`}
          onClick={() => {
              createNewConversation();
              if(isMobile && onSelectConversation) onSelectConversation();
          }}
          title={isMobile ? "Nova Conversa" : ""}
          aria-label="Nova Conversa"
        >
          <IoAddCircleOutline size={20} className={'group-hover/newConvo:scale-110 transition-transform'} />
          <span className="whitespace-nowrap">Nova Conversa</span>
        </Button>
      </div>

      <nav className={`flex-grow flex flex-col min-h-0 mt-4`}>
          <p className="text-xs text-slate-500 uppercase mb-2 px-2 font-semibold tracking-wider whitespace-nowrap">
            Recentes
          </p>
        <div className={`flex-grow overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 scrollbar-track-transparent pr-0.5`}>
          {sortedConversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => editingConversationId !== convo.id && handleSelectConvo(convo.id)}
              title={convo.title}
              className={`group/convoItem w-full flex items-center rounded-lg cursor-pointer text-sm text-left
                          transition-all duration-150 ease-in-out relative p-2.5 space-x-1.5
                          ${editingConversationId === convo.id
                              ? 'bg-slate-700 ring-1 ring-blue-500'
                              : convo.id === activeConversationId
                                  ? `text-white font-medium ${isMobile ? 'bg-blue-600' : 'bg-blue-600 shadow'}`
                                  : `text-slate-300 ${isMobile ? 'hover:bg-slate-800' : 'hover:bg-slate-800 hover:text-slate-100'}`
                          }`}
            >
              {editingConversationId === convo.id ? (
                <input
                  type="text"
                  value={tempTitle}
                  onChange={handleTitleChange}
                  onKeyDown={(e) => handleTitleKeyDown(e, convo.id)}
                  onBlur={() => handleSaveTitle(convo.id)}
                  autoFocus
                  className="flex-1 bg-transparent text-white focus:outline-none border-b border-blue-500/50 text-sm py-0.5"
                />
              ) : (
                <>
                  <IoChatbubbleEllipsesOutline
                    size={18}
                    className={`flex-shrink-0 transition-colors
                                ${convo.id === activeConversationId
                                    ? (isMobile ? 'text-white' : 'text-blue-100')
                                    : (isMobile ? 'text-slate-400 group-hover/convoItem:text-slate-200' : 'text-slate-500 group-hover/convoItem:text-slate-400')
                                }`}
                  />
                  <span className="truncate flex-1">{convo.title}</span>
                </>
              )}

              {editingConversationId !== convo.id && (
                <div className={`flex-shrink-0 flex items-center opacity-0 group-hover/convoItem:opacity-100 focus-within:opacity-100
                                transition-opacity duration-150
                                [&>button]:p-1 [&>button]:rounded-md
                                ${convo.id === activeConversationId
                                  ? '!opacity-100 [&>button:hover]:!bg-blue-500/80'
                                  : '[&>button:hover]:bg-slate-700/70'
                                }`}>
                  <button
                    onClick={(e) => handleStartEditTitle(e, convo)}
                    title="Editar título"
                    aria-label="Editar título da conversa"
                    className={`${convo.id === activeConversationId ? 'text-blue-100 hover:text-white' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    <IoPencilOutline size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(e, convo.id)}
                    title="Excluir conversa"
                    aria-label="Excluir conversa"
                    className={`${convo.id === activeConversationId ? 'text-blue-100 hover:text-red-300' : 'text-slate-400 hover:text-red-400'}`}
                  >
                    <IoTrashBinOutline size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {sortedConversations.length === 0 && (
            <p className={`text-sm text-slate-500 text-center py-4 px-2`}>
              Seu histórico de conversas aparecerá aqui.
            </p>
          )}
        </div>
      </nav>

      <div className={`pt-3 border-t border-slate-800`}>
        <button
          onClick={onOpenSettings}
          className={`w-full text-left text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-lg
                      flex items-center transition-colors duration-150 ease-in-out text-sm group/settings p-2.5 space-x-3`}
          aria-label="Configurações"
        >
          <IoSettingsOutline size={20} className={`text-slate-400 group-hover/settings:text-slate-200`} />
          <span>Configurações</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;