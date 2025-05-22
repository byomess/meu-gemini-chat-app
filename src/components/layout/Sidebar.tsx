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
    if (editingConversationId === conversationId && tempTitle.trim()) {
      const originalConversation = conversations.find(c => c.id === conversationId);
      if (originalConversation && originalConversation.title !== tempTitle.trim()) {
        updateConversationTitle(conversationId, tempTitle.trim());
      }
    }
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

  const baseClasses = `bg-white text-gray-700 h-screen flex flex-col p-3 transition-all duration-300 ease-in-out shadow-xl`;
  
  const desktopSpecificClasses = `w-64 md:w-72 border-r border-gray-200 relative`;
  
  const mobileSpecificClasses = `fixed inset-y-0 left-0 w-3/4 max-w-sm z-50 border-r border-gray-200 
                                 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

  const finalAsideClasses = isMobile 
    ? `${baseClasses} ${mobileSpecificClasses}` 
    : `${baseClasses} ${desktopSpecificClasses}`;

  return (
    <aside className={finalAsideClasses}>
      {isMobile && onCloseMobile && isOpen && (
          <Button
            variant="ghost" // Using ghost variant for custom background/text
            size="icon-md" // For p-2 rounded-full
            onClick={onCloseMobile}
            className="absolute top-4 -right-12 z-[51] bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"
            title="Fechar menu"
            aria-label="Fechar menu"
          >
            <IoCloseOutline size={26} />
          </Button>
      )}

      <div className="mb-3">
        <Button
          variant="primary"
          className={`w-full !py-2.5 flex items-center justify-center space-x-2.5 rounded-lg
                      text-sm font-semibold shadow-md hover:shadow-lg 
                      focus:ring-offset-white 
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
          <p className="text-xs text-gray-600 uppercase mb-2.5 px-1.5 font-semibold tracking-wider whitespace-nowrap">
            Recentes
          </p>
        <div className={`flex-grow overflow-y-auto space-y-1 pr-1 -mr-1`}>
          {sortedConversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => editingConversationId !== convo.id && handleSelectConvo(convo.id)}
              title={convo.title}
              className={`group/convoItem w-full flex items-center rounded-lg text-sm text-left
                          transition-all duration-150 ease-in-out relative p-2.5 space-x-2.5
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e04579] focus-visible:ring-offset-2 focus-visible:ring-offset-white
                          ${editingConversationId === convo.id
                              ? 'bg-gray-200 shadow-inner cursor-default'
                              : convo.id === activeConversationId
                                  ? `text-white font-semibold bg-[#e04579] shadow-md hover:bg-[#c73d6a] cursor-pointer`
                                  : `text-gray-700 hover:bg-pink-50 hover:text-gray-900 cursor-pointer`
                          }`}
            >
              {editingConversationId === convo.id ? (
                <div className="flex-1 flex items-center space-x-2">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={handleTitleChange}
                    onKeyDown={(e) => handleTitleKeyDown(e, convo.id)}
                    onBlur={() => handleSaveTitle(convo.id)}
                    autoFocus
                    className="flex-1 bg-transparent text-gray-800 focus:outline-none border-b-2 border-[#e04579]/70 focus:border-[#e04579] text-sm py-0.5 transition-colors rounded-none"
                  />
                  <Button
                    variant="ghost" // Using ghost variant for minimal styling
                    size="icon-sm" // For p-1.5 rounded-md
                    onMouseDown={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation();
                        handleCancelEditTitle();
                    }}
                    className="text-gray-500 hover:text-gray-800 flex-shrink-0 hover:bg-gray-300"
                    title="Cancelar edição (Esc)"
                    aria-label="Cancelar renomeação da conversa"
                  >
                    <IoCloseOutline size={18} />
                  </Button>
                </div>
              ) : (
                <>
                  <IoChatbubbleEllipsesOutline
                    size={19}
                    className={`flex-shrink-0 transition-colors duration-200
                                ${convo.id === activeConversationId
                                    ? 'text-white'
                                    : 'text-gray-500 group-hover/convoItem:text-gray-700'
                                }`}
                  />
                  <span className="truncate flex-1 text-sm">{convo.title}</span>
                  {convo.id === activeConversationId && !isMobile && (
                    <IoChevronForward size={16} className="text-white opacity-80 ml-auto" />
                  )}
                </>
              )}

              {editingConversationId !== convo.id && (
                <div className={`flex-shrink-0 flex items-center opacity-0 group-hover/convoItem:opacity-100 
                                group-focus-within/convoItem:opacity-100
                                transition-opacity duration-200 ease-in-out
                                absolute right-2 top-1/2 -translate-y-1/2 
                                bg-gray-100/50 group-hover/convoItem:bg-gray-200/80 backdrop-blur-sm rounded-md p-0.5 space-x-0.5
                                [&>button]:p-1.5 [&>button]:rounded-md 
                                ${convo.id === activeConversationId
                                  ? '!opacity-100 !bg-[#e04579]/20 group-hover/convoItem:!bg-[#e04579]/30 [&>button:hover]:!bg-[#e04579]/40'
                                  : '[&>button:hover]:bg-gray-300/80'
                                }`}>
                  <Button
                    variant="ghost" // Using ghost variant for minimal styling
                    size="icon-sm" // For p-1.5 rounded-md
                    onClick={(e) => handleStartEditTitle(e, convo)}
                    title="Editar título"
                    aria-label="Editar título da conversa"
                    className={`${convo.id === activeConversationId ? 'text-white opacity-80 hover:text-white' : 'text-gray-500 hover:text-gray-800'} transition-colors`}
                  >
                    <IoPencilOutline size={15} />
                  </Button>
                  <Button
                    variant="ghost" // Using ghost variant for minimal styling
                    size="icon-sm" // For p-1.5 rounded-md
                    onClick={(e) => handleDeleteConversation(e, convo.id)}
                    title="Excluir conversa"
                    aria-label="Excluir conversa"
                    className={`${convo.id === activeConversationId ? 'text-white opacity-80 hover:text-red-200' : 'text-gray-500 hover:text-red-500'} transition-colors`}
                  >
                    <IoTrashBinOutline size={15} />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {sortedConversations.length === 0 && (
            <p className={`text-sm text-gray-500 text-center py-6 px-3 italic`}>
              Nenhuma conversa ainda. <br/>Clique em "Nova Conversa" para começar.
            </p>
          )}
        </div>
      </nav>

    <div className="flex flex-col justify-center items-center pt-4">
      <img src="/logo-aulapp.svg" alt="Logo Loox" className={`w-36 h-auto`} />
      <span className="text-xs text-gray-600 mb-2.5 px-1.5 tracking-wider whitespace-nowrap">
        powered by Loox AI ®
      </span>
    </div>

      <div className={`pt-3 mt-2 border-t border-gray-200`}>
        <Button
          variant="ghost" // Using ghost variant for minimal styling
          onClick={onOpenSettings}
          className={`w-full text-left rounded-lg flex items-center text-sm group/settings p-2.5 space-x-3
                      hover:bg-pink-50 hover:text-gray-900 focus-visible:ring-[#e04579] focus-visible:ring-offset-1 focus-visible:ring-offset-white`}
          aria-label="Configurações"
        >
          <IoSettingsOutline size={20} className={`text-gray-500 group-hover/settings:text-[#e04579] group-hover/settings:rotate-45 transition-all duration-300`} />
          <span className="font-medium">Configurações</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
