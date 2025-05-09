// src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import Button from '../common/Button';
import {
  IoSettingsOutline,
  IoAddCircleOutline,
  IoChatbubbleEllipsesOutline,
  IoTrashBinOutline,
  IoPencilOutline,
  IoChevronBack,    // Ícone Chevron Back (sem Outline para mais peso)
  IoChevronForward, // Ícone Chevron Forward
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext';
import type { Conversation } from '../../types';

interface SidebarProps {
  onOpenSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings, isCollapsed, onToggleCollapse }) => {
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

  const sortedConversations = conversations;

  const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.')) {
      deleteConversation(conversationId);
    }
  };

  const handleStartEditTitle = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    setEditingConversationId(conversation.id);
    setTempTitle(conversation.title);
  };

  const handleSaveTitle = (conversationId: string) => {
    if (tempTitle.trim() && editingConversationId === conversationId) {
      updateConversationTitle(conversationId, tempTitle.trim());
    }
    setEditingConversationId(null);
    setTempTitle('');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTitle(e.target.value);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, conversationId: string) => {
    if (e.key === 'Enter') {
      handleSaveTitle(conversationId);
    } else if (e.key === 'Escape') {
      setEditingConversationId(null);
      setTempTitle('');
    }
  };

  return (
    <aside
      className={`flex flex-col bg-slate-950 text-slate-200 h-screen border-r border-slate-800 
                  transition-all duration-300 ease-in-out relative
                  ${isCollapsed ? 'w-[72px] p-2 pt-12' : 'w-60 md:w-72 p-3'}`} // Largura fixa para colapsado, padding top para o botão
    >
      {/* Botão de Encolher/Expandir */}
      <button
        onClick={onToggleCollapse}
        className={`absolute top-[1.4rem] z-20 p-1.5 text-slate-400 bg-slate-700/50 hover:text-slate-100 hover:bg-slate-700/70 rounded-md
                    transition-all duration-300 ease-in-out
                    ${isCollapsed ? 'right-1/2 translate-x-1/2 top-5' : 'right-[-1rem]'}`}
        title={isCollapsed ? "Expandir sidebar" : "Encolher sidebar"}
        aria-label={isCollapsed ? "Expandir sidebar" : "Encolher sidebar"}
      >
        {isCollapsed ? <IoChevronForward size={20} /> : <IoChevronBack size={20} />}
      </button>

      {/* Botão Nova Conversa */}
      <div className={`mt-2 ${isCollapsed ? 'w-full flex justify-center' : ''}`}>
        <Button
          variant="primary"
          className={`w-full !py-2 flex items-center text-sm font-medium shadow-sm hover:shadow-md 
                      transition-all duration-200 ease-in-out group/newConvo
                      ${isCollapsed ? 'justify-center !px-0 h-12 w-12 rounded-xl' : 'justify-center space-x-2 rounded-lg'}`}
          onClick={createNewConversation}
          title={isCollapsed ? "Nova Conversa" : ""}
        >
          <IoAddCircleOutline size={isCollapsed ? 24 : 20} className={`${isCollapsed ? '' : 'group-hover/newConvo:scale-110 transition-transform'}`} />
          {!isCollapsed && <span className="whitespace-nowrap">Nova Conversa</span>}
        </Button>
      </div>

      {/* Navegação (Histórico) */}
      <nav className={`flex-grow flex flex-col min-h-0 mt-4 ${isCollapsed ? 'items-center' : ''}`}>
        {!isCollapsed && (
          <p className="text-xs text-slate-500 uppercase mb-2 px-2 font-semibold tracking-wider whitespace-nowrap">
            Recentes
          </p>
        )}
        <div className={`flex-grow overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 scrollbar-track-transparent
                       ${isCollapsed ? 'w-full flex flex-col items-center' : 'pr-0.5'}`}>
          {sortedConversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => editingConversationId !== convo.id && setActiveConversationId(convo.id)}
              title={convo.title} // Mostrar sempre o título no hover
              className={`group/convoItem w-full flex items-center justify-between rounded-lg cursor-pointer text-sm text-left 
                          transition-all duration-150 ease-in-out relative
                          ${isCollapsed ? 'p-3 justify-center h-12 w-12' : 'p-2.5 space-x-1.5'}
                          ${editingConversationId === convo.id && !isCollapsed
                              ? 'bg-slate-700 ring-1 ring-blue-500' // Estilo para edição de título
                              : convo.id === activeConversationId
                                  ? `text-white font-medium ${isCollapsed ? 'bg-blue-600' : 'bg-blue-600 shadow'}` // Cor de fundo para ativo colapsado
                                  : `text-slate-300 ${isCollapsed ? 'hover:bg-slate-800' : 'hover:bg-slate-800 hover:text-slate-100'}`
                          }`}
            >
              {/* Modo de Edição (apenas se não estiver colapsado) */}
              {editingConversationId === convo.id && !isCollapsed ? (
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
                // Ícone e Título (ou apenas Ícone se colapsado)
                <>
                  <IoChatbubbleEllipsesOutline
                    size={isCollapsed ? 24 : 18} // Ícone maior quando colapsado
                    className={`flex-shrink-0 transition-colors
                                ${convo.id === activeConversationId 
                                    ? (isCollapsed ? 'text-white' : 'text-blue-100') 
                                    : (isCollapsed ? 'text-slate-400 group-hover/convoItem:text-slate-200' : 'text-slate-500 group-hover/convoItem:text-slate-400')
                                }`}
                  />
                  {!isCollapsed && <span className="truncate flex-1">{convo.title}</span>}
                </>
              )}

              {/* Botões de Ação (apenas se não estiver colapsado e não editando) */}
              {!isCollapsed && editingConversationId !== convo.id && (
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
            <p className={`text-sm text-slate-500 text-center py-4 ${isCollapsed ? 'hidden' : 'px-2'}`}>
              Seu histórico de conversas aparecerá aqui.
            </p>
          )}
        </div>
      </nav>

      {/* Rodapé da Sidebar */}
      <div className={`pt-3 border-t border-slate-800 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        <button
          onClick={onOpenSettings}
          className={`w-full text-left text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-lg 
                      flex items-center transition-colors duration-150 ease-in-out text-sm group/settings
                      ${isCollapsed ? 'justify-center p-3 h-12 w-12' : 'p-2.5 space-x-3'}`}
          title={isCollapsed ? "Configurações" : ""}
        >
          <IoSettingsOutline size={isCollapsed ? 24 : 20} className={`text-slate-400 ${isCollapsed ? '' : 'group-hover/settings:text-slate-200'}`} />
          {!isCollapsed && <span>Configurações</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;