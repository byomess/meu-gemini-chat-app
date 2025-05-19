import React, { useState, useCallback } from 'react';
import Button from '../common/Button'; // Certifique-se que o caminho está correto
import {
  IoSettingsOutline,
  IoAddCircleOutline,
  IoChatbubbleEllipsesOutline,
  IoTrashBinOutline,
  IoPencilOutline,
  IoCloseOutline,
  IoChevronForward, 
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import type { Conversation } from '../../types';

interface SidebarProps {
  onOpenSettings: () => void;
  isMobile: boolean;
  isOpen?: boolean;
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

  const sortedConversations = [...conversations]; 

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
    // Somente salva se ainda estiver no modo de edição para este item específico
    // e se o tempTitle for válido e diferente do original.
    if (editingConversationId === conversationId && tempTitle.trim()) {
      const originalConversation = conversations.find(c => c.id === conversationId);
      if (originalConversation && originalConversation.title !== tempTitle.trim()) {
        updateConversationTitle(conversationId, tempTitle.trim());
      }
    }
    // Sempre sai do modo de edição, mesmo que não salve (ex: título vazio ou igual)
    setEditingConversationId(null);
    setTempTitle('');
  }, [tempTitle, editingConversationId, updateConversationTitle, conversations]);

  const handleCancelEditTitle = useCallback(() => {
    setEditingConversationId(null);
    setTempTitle('');
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTitle(e.target.value);
  }, []);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, conversationId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle(conversationId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEditTitle();
    }
  }, [handleSaveTitle, handleCancelEditTitle]);

  const handleSelectConvo = useCallback((convoId: string) => {
    setActiveConversationId(convoId);
    if (isMobile && onSelectConversation) {
        onSelectConversation();
    }
  }, [setActiveConversationId, isMobile, onSelectConversation]);

  const baseClasses = `bg-slate-950 text-slate-300 h-screen flex flex-col p-3 transition-all duration-300 ease-in-out shadow-xl`;
  
  const desktopSpecificClasses = `w-64 md:w-72 border-r border-slate-800/70 relative`;
  
  const mobileSpecificClasses = `fixed inset-y-0 left-0 w-3/4 max-w-sm z-50 border-r border-slate-800/70 
                                 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

  const finalAsideClasses = isMobile 
    ? `${baseClasses} ${mobileSpecificClasses}` 
    : `${baseClasses} ${desktopSpecificClasses}`;

  return (
    <aside className={finalAsideClasses}>
      {isMobile && onCloseMobile && isOpen && (
          <button
            onClick={onCloseMobile}
            className="absolute top-4 -right-12 p-1.5 text-slate-400 hover:text-slate-100 rounded-full z-[51] transition-colors bg-slate-700/50 hover:bg-slate-600/50"
            title="Fechar menu"
            aria-label="Fechar menu"
          >
            <IoCloseOutline size={26} />
          </button>
      )}

      <div className="mb-3">
        <Button
          variant="primary"
          className={`w-full !py-2.5 flex items-center justify-center space-x-2.5 rounded-lg
                      text-sm font-semibold shadow-md hover:shadow-lg !bg-blue-600 hover:!bg-blue-500 active:!bg-blue-700
                      focus:ring-offset-slate-950
                      transition-all duration-200 ease-in-out group/newConvo transform active:scale-[0.98]`}
          onClick={() => {
              createNewConversation();
              if(isMobile && onSelectConversation) onSelectConversation();
          }}
          title={isMobile ? "Nova Conversa" : ""}
          aria-label="Nova Conversa"
        >
          <IoAddCircleOutline size={22} className={'group-hover/newConvo:scale-110 group-hover/newConvo:rotate-90 transition-transform duration-300'} />
          <span className="whitespace-nowrap">Nova Conversa</span>
        </Button>
      </div>

      <nav className={`flex-grow flex flex-col min-h-0`}>
          <p className="text-xs text-slate-500/80 uppercase mb-2.5 px-1.5 font-semibold tracking-wider whitespace-nowrap">
            Recentes
          </p>
        <div className={`flex-grow overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 scrollbar-track-transparent pr-1 -mr-1`}>
          {sortedConversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => editingConversationId !== convo.id && handleSelectConvo(convo.id)}
              title={convo.title}
              className={`group/convoItem w-full flex items-center rounded-lg text-sm text-left
                          transition-all duration-150 ease-in-out relative p-2.5 space-x-2.5
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                          ${editingConversationId === convo.id
                              ? 'bg-slate-700/60 shadow-inner cursor-default' 
                              : convo.id === activeConversationId
                                  ? `text-white font-semibold bg-blue-600/90 shadow-md hover:bg-blue-600 cursor-pointer`
                                  : `text-slate-300 hover:bg-slate-800/70 hover:text-slate-100 cursor-pointer`
                          }`}
            >
              {editingConversationId === convo.id ? (
                <div className="flex-1 flex items-center space-x-2">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={handleTitleChange}
                    onKeyDown={(e) => handleTitleKeyDown(e, convo.id)}
                    onBlur={() => handleSaveTitle(convo.id)} // Simplificado: onBlur sempre tenta salvar/sair da edição
                    autoFocus
                    className="flex-1 bg-transparent text-white focus:outline-none border-b-2 border-blue-500/70 focus:border-blue-500 text-sm py-0.5 transition-colors rounded-none"
                  />
                  <button
                    // Usar onMouseDown para garantir que dispare antes do onBlur do input
                    onMouseDown={(e) => { 
                        e.preventDefault(); // Previne que o input perca o foco imediatamente (e dispare onBlur)
                        e.stopPropagation();
                        handleCancelEditTitle();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-100 flex-shrink-0 rounded-md hover:bg-slate-600/50"
                    title="Cancelar edição (Esc)"
                    aria-label="Cancelar renomeação da conversa"
                  >
                    <IoCloseOutline size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <IoChatbubbleEllipsesOutline
                    size={19}
                    className={`flex-shrink-0 transition-colors duration-200
                                ${convo.id === activeConversationId
                                    ? 'text-slate-100' 
                                    : 'text-slate-500 group-hover/convoItem:text-slate-300'
                                }`}
                  />
                  <span className="truncate flex-1 text-sm">{convo.title}</span>
                  {convo.id === activeConversationId && !isMobile && (
                    <IoChevronForward size={16} className="text-slate-300 opacity-70 ml-auto" />
                  )}
                </>
              )}

              {editingConversationId !== convo.id && (
                <div className={`flex-shrink-0 flex items-center opacity-0 group-hover/convoItem:opacity-100 
                                group-focus-within/convoItem:opacity-100
                                transition-opacity duration-200 ease-in-out
                                absolute right-2 top-1/2 -translate-y-1/2 
                                bg-slate-800/50 group-hover/convoItem:bg-slate-700/80 backdrop-blur-sm rounded-md p-0.5 space-x-0.5
                                [&>button]:p-1.5 [&>button]:rounded-md 
                                ${convo.id === activeConversationId
                                  ? '!opacity-100 !bg-blue-700/50 group-hover/convoItem:!bg-blue-600/70 [&>button:hover]:!bg-blue-500/60'
                                  : '[&>button:hover]:bg-slate-600/80'
                                }`}>
                  <button
                    onClick={(e) => handleStartEditTitle(e, convo)}
                    title="Editar título"
                    aria-label="Editar título da conversa"
                    className={`${convo.id === activeConversationId ? 'text-blue-100 hover:text-white' : 'text-slate-400 hover:text-slate-100'} transition-colors`}
                  >
                    <IoPencilOutline size={15} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(e, convo.id)}
                    title="Excluir conversa"
                    aria-label="Excluir conversa"
                    className={`${convo.id === activeConversationId ? 'text-blue-100 hover:text-red-300' : 'text-slate-400 hover:text-red-400'} transition-colors`}
                  >
                    <IoTrashBinOutline size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {sortedConversations.length === 0 && (
            <p className={`text-sm text-slate-500/90 text-center py-6 px-3 italic`}>
              Nenhuma conversa ainda. <br/>Clique em "Nova Conversa" para começar.
            </p>
          )}
        </div>
      </nav>

    <div className="flex flex-col justify-center items-center pt-4">
      <img src="/logo-loox.png" alt="Logo Loox" className={`w-36 h-auto`} />
      <span className="text-xs text-slate-500/80 mb-2.5 px-1.5 tracking-wider whitespace-nowrap">
        by Doublewave ®
      </span>
    </div>

      <div className={`pt-3 mt-2 border-t border-slate-800/70`}>
        <button
          onClick={onOpenSettings}
          className={`w-full text-left text-slate-300 hover:bg-slate-800/70 hover:text-slate-100 rounded-lg
                      flex items-center transition-colors duration-150 ease-in-out text-sm group/settings p-2.5 space-x-3
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950`}
          aria-label="Configurações"
        >
          <IoSettingsOutline size={20} className={`text-slate-500 group-hover/settings:text-slate-300 group-hover/settings:rotate-45 transition-all duration-300`} />
          <span className="font-medium">Configurações</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;