import React, { useState, useCallback, useRef, useEffect } from 'react';
import Button from '../common/Button'; // Certifique-se que o caminho está correto
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
import Dropdown from '../common/Dropdown'; // Import the new Dropdown component
import DropdownItem from '../common/DropdownItem'; // Import the new DropdownItem component

// Import GhostIcon from lucide-react or similar if available, otherwise use a placeholder or another icon
import { GhostIcon } from 'lucide-react'; // Example: if you have lucide-react installed

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

  const handleNewChatClick = useCallback((isIncognito: boolean = false) => {
    createNewConversation({ isIncognito });
    // No need to close options here, Dropdown component handles it
    if(isMobile && onSelectConversation) onSelectConversation();
  }, [createNewConversation, isMobile, onSelectConversation]);

  const baseClasses = `bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] h-screen flex flex-col p-3 transition-all duration-300 ease-in-out shadow-xl`;
  
  const desktopSpecificClasses = `w-64 md:w-72 border-r border-[var(--color-sidebar-border)] relative`;
  
  const mobileSpecificClasses = `fixed inset-y-0 left-0 w-3/4 max-w-sm z-50 border-r border-[var(--color-sidebar-border)] 
                                 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

  const finalAsideClasses = isMobile 
    ? `${baseClasses} ${mobileSpecificClasses}` 
    : `${baseClasses} ${desktopSpecificClasses}`;

  // Determine logo and text based on hostname
  const isAulappDomain = typeof window !== 'undefined' && window.location.hostname === 'aulapp-loox-ai.vercel.app';
  const logoSrc = isAulappDomain ? '/logo-aulapp.svg' : '/logo-loox.png';
  const logoText = isAulappDomain ? 'powered by Loox AI ®' : 'by Doublewave ®';
  const logoAlt = isAulappDomain ? 'Logo Aulapp' : 'Logo Loox';


  return (
    <aside className={finalAsideClasses}>
      {isMobile && onCloseMobile && isOpen && (
          <Button
            variant="ghost" // Using ghost variant for custom background/text
            size="icon-md" // For p-2 rounded-full
            onClick={onCloseMobile}
            className="absolute top-4 -right-12 z-[51] bg-[var(--color-mobile-close-button-bg)] hover:bg-[var(--color-mobile-close-button-hover-bg)] text-[var(--color-mobile-close-button-icon)] hover:text-[var(--color-mobile-close-button-hover-icon)]"
            title="Fechar menu"
            aria-label="Fechar menu"
          >
            <IoCloseOutline size={26} />
          </Button>
      )}

      <div className="mb-3 relative"> {/* Added relative for positioning options */}
        <Dropdown
            trigger={
                <Button
                    variant="primary"
                    className={`w-full !py-2.5 flex items-center justify-center space-x-2.5 rounded-lg
                                text-sm font-semibold shadow-md hover:shadow-lg 
                                focus:ring-offset-[var(--color-focus-ring-offset)] 
                                transition-all duration-200 ease-in-out group/newConvo transform active:scale-[0.98]
                                bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]`}
                    title={isMobile ? "Nova Conversa" : ""}
                    aria-label="Nova Conversa"
                >
                    <IoAddCircleOutline size={22} className={'group-hover/newConvo:scale-110 group-hover/newConvo:rotate-90 transition-transform duration-300'} />
                    <span className="whitespace-nowrap">Nova Conversa</span>
                </Button>
            }
            position="left" // Position the dropdown menu to the left
            menuClassName="w-full" // Make the dropdown menu take full width of its parent
        >
            <DropdownItem onClick={() => handleNewChatClick(false)} icon={<IoChatbubbleEllipsesOutline size={18} />}>
                Conversa Padrão
            </DropdownItem>
            <DropdownItem onClick={() => handleNewChatClick(true)} icon={<GhostIcon size={18} />}>
                Conversa Incógnita
            </DropdownItem>
        </Dropdown>
      </div>

      <nav className={`flex-grow flex flex-col min-h-0`}>
          <p className="text-xs text-[var(--color-sidebar-heading-text)] uppercase mb-2.5 px-1.5 font-semibold tracking-wider whitespace-nowrap">
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
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-focus-ring-offset)]
                          ${editingConversationId === convo.id
                              ? 'bg-[var(--color-convo-item-edit-bg)] shadow-inner cursor-default'
                              : convo.id === activeConversationId
                                  ? `text-[var(--color-convo-item-active-text)] font-semibold ${convo.isIncognito ? 'bg-[var(--color-convo-item-incognito-active-bg)]' : 'bg-[var(--color-convo-item-active-bg)]'} shadow-md hover:bg-[var(--color-primary-dark)] cursor-pointer`
                                  : `${convo.isIncognito ? 'bg-[var(--color-convo-item-incognito-bg)] text-[var(--color-convo-item-incognito-text)] hover:bg-[var(--color-convo-item-incognito-hover-bg)] hover:text-[var(--color-convo-item-incognito-hover-text)]' : 'text-[var(--color-convo-item-text)] hover:bg-[var(--color-convo-item-hover-bg)] hover:text-[var(--color-convo-item-hover-text)]'} cursor-pointer`
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
                    className="flex-1 bg-transparent text-[var(--color-convo-item-edit-text)] focus:outline-none border-b-2 border-[var(--color-convo-item-edit-border)] focus:border-[var(--color-convo-item-edit-focus-border)] text-sm py-0.5 transition-colors rounded-none"
                  />
                  <Button
                    variant="ghost" // Using ghost variant for minimal styling
                    size="icon-sm" // For p-1.5 rounded-md
                    onMouseDown={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation();
                        handleCancelEditTitle();
                    }}
                    className="text-[var(--color-convo-item-actions-icon)] hover:text-[var(--color-convo-item-actions-hover-icon)] flex-shrink-0 hover:bg-[var(--color-convo-item-actions-button-hover-bg)]"
                    title="Cancelar edição (Esc)"
                    aria-label="Cancelar renomeação da conversa"
                  >
                    <IoCloseOutline size={18} />
                  </Button>
                </div>
              ) : (
                <>
                  {convo.isIncognito ? (
                    <GhostIcon
                      size={19}
                      className={`flex-shrink-0 transition-colors duration-200
                                  ${convo.id === activeConversationId
                                      ? 'text-[var(--color-convo-item-incognito-active-icon)]'
                                      : 'text-[var(--color-convo-item-incognito-icon)] group-hover/convoItem:text-[var(--color-convo-item-incognito-hover-icon)]'
                                  }`}
                    />
                  ) : (
                    <IoChatbubbleEllipsesOutline
                      size={19}
                      className={`flex-shrink-0 transition-colors duration-200
                                  ${convo.id === activeConversationId
                                      ? 'text-[var(--color-convo-item-active-icon)]'
                                      : 'text-[var(--color-convo-item-icon)] group-hover/convoItem:text-[var(--color-convo-item-hover-icon)]'
                                  }`}
                    />
                  )}
                  <span className="truncate flex-1 text-sm">
                    {convo.title}
                    {/* Removed the GhostIcon that was here */}
                  </span>
                  {/* Removed IoChevronForward component */}
                </>
              )}

              {editingConversationId !== convo.id && (
                <div className={`flex-shrink-0 flex items-center opacity-0 group-hover/convoItem:opacity-100 w-14 justify-end
                                group-focus-within/convoItem:opacity-100
                                transition-opacity duration-200 ease-in-out
                                bg-[var(--color-convo-item-actions-bg)] group-hover/convoItem:bg-[var(--color-convo-item-actions-hover-bg)] backdrop-blur-sm rounded-md p-0.5 space-x-0.5
                                [&>button]:p-1.5 [&>button]:rounded-md 
                                ${convo.id === activeConversationId
                                  ? '!opacity-100 !bg-[var(--color-convo-item-active-actions-bg)] group-hover/convoItem:!bg-[var(--color-convo-item-active-actions-hover-bg)] [&>button:hover]:!bg-[var(--color-convo-item-active-actions-button-hover-bg)]'
                                  : '[&>button:hover]:bg-[var(--color-convo-item-actions-button-hover-bg)]'
                                }`}>
                  <Button
                    variant="ghost" // Using ghost variant for minimal styling
                    size="icon-sm" // For p-1.5 rounded-md
                    onClick={(e) => handleStartEditTitle(e, convo)}
                    title="Editar título"
                    aria-label="Editar título da conversa"
                    className={`${convo.id === activeConversationId ? 'text-[var(--color-convo-item-active-actions-icon)] opacity-80 hover:text-[var(--color-convo-item-active-actions-icon)]' : 'text-[var(--color-convo-item-actions-icon)] hover:text-[var(--color-convo-item-actions-hover-icon)]'} transition-colors`}
                  >
                    <IoPencilOutline size={15} />
                  </Button>
                  <Button
                    variant="ghost" // Using ghost variant for minimal styling
                    size="icon-sm" // For p-1.5 rounded-md
                    onClick={(e) => handleDeleteConversation(e, convo.id)}
                    title="Excluir conversa"
                    aria-label="Excluir conversa"
                    className={`${convo.id === activeConversationId ? 'text-[var(--color-convo-item-active-actions-icon)] opacity-80 hover:text-[var(--color-convo-item-active-actions-delete-hover-icon)]' : 'text-[var(--color-convo-item-actions-icon)] hover:text-[var(--color-convo-item-actions-delete-hover-icon)]'} transition-colors`}
                  >
                    <IoTrashBinOutline size={15} />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {sortedConversations.length === 0 && (
            <p className={`text-sm text-[var(--color-gray-500)] text-center py-6 px-3 italic`}>
              Nenhuma conversa ainda. <br/>Clique em "Nova Conversa" para começar.
            </p>
          )}
        </div>
      </nav>

    <div className="flex flex-col justify-center items-center pt-4">
      <img src={logoSrc} alt={logoAlt} className={`w-36 h-auto`} />
      <span className="text-xs text-[var(--color-logo-text)] mb-2.5 px-1.5 tracking-wider whitespace-nowrap">
        {logoText}
      </span>
    </div>

      <div className={`pt-3 mt-2 border-t border-[var(--color-sidebar-border)]`}>
        <Button
          variant="ghost" // Using ghost variant for minimal styling
          onClick={onOpenSettings}
          className={`w-full text-left rounded-lg flex items-center text-sm group/settings p-2.5 space-x-3
                      hover:bg-[var(--color-settings-button-hover-bg)] hover:text-[var(--color-settings-button-hover-text)] focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-focus-ring-offset)]`}
          aria-label="Configurações"
        >
          <IoSettingsOutline size={20} className={`text-[var(--color-settings-button-icon)] group-hover/settings:text-[var(--color-settings-button-hover-icon)] group-hover/settings:rotate-45 transition-all duration-300`} />
          <span className="font-medium">Configurações</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
