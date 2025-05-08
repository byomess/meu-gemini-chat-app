// src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import Button from '../common/Button';
import {
    IoSettingsOutline,
    IoAddCircleOutline,
    IoChatbubbleEllipsesOutline,
    IoTrashBinOutline,
    IoPencilOutline, // Para futuro editar título
} from 'react-icons/io5';
import { useConversations } from '../../contexts/ConversationContext'; // Importar o hook
import type { Conversation } from '../../types'; // Importar o tipo

interface SidebarProps {
    onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
    const {
        conversations,
        activeConversationId,
        setActiveConversationId,
        createNewConversation,
        deleteConversation,
        updateConversationTitle, // Para futura edição de título
    } = useConversations();

    // Estado para controlar qual conversa tem o menu de contexto (reticências) aberto
    // E qual conversa está em modo de edição de título
    const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState<string>('');


    // Não é mais necessário ordenar aqui, pois o contexto já deve fornecer a lista ordenada.
    // Se o contexto não garantir a ordenação, descomente a linha abaixo.
    // const sortedConversations = [...conversations].sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const sortedConversations = conversations; // Assumindo que o contexto já ordena


    const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation(); // Impede que o clique no botão de deletar também selecione a conversa
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
        <aside className="w-60 md:w-72 flex flex-col bg-slate-950 text-slate-200 p-3 space-y-4 h-screen border-r border-slate-800">
            <div>
                <Button
                    variant="primary"
                    className="w-full !py-2.5 flex items-center justify-center space-x-2 text-sm font-medium shadow-sm hover:shadow-md transition-shadow"
                    onClick={createNewConversation} // Usar a função do contexto
                >
                    <IoAddCircleOutline size={20} />
                    <span>Nova Conversa</span>
                </Button>
            </div>

            <nav className="flex-grow flex flex-col min-h-0">
                <p className="text-xs text-slate-500 uppercase mb-2 px-2 font-semibold tracking-wider">
                    Recentes
                </p>
                <div className="flex-grow overflow-y-auto space-y-1 pr-0.5 scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 scrollbar-track-transparent">
                    {sortedConversations.map((convo) => (
                        <div
                            key={convo.id}
                            onClick={() => editingConversationId !== convo.id && setActiveConversationId(convo.id)}
                            title={editingConversationId === convo.id ? "Editando título..." : convo.title}
                            className={`group w-full flex items-center justify-between space-x-1.5 p-2.5 rounded-lg cursor-pointer text-sm text-left transition-all duration-150 ease-in-out
                ${editingConversationId === convo.id
                                    ? 'bg-slate-700 ring-1 ring-blue-500' // Estilo para edição
                                    : convo.id === activeConversationId
                                        ? 'bg-blue-600 text-white font-medium shadow'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                                }`}
                        >
                            {editingConversationId === convo.id ? (
                                <input
                                    type="text"
                                    value={tempTitle}
                                    onChange={handleTitleChange}
                                    onKeyDown={(e) => handleTitleKeyDown(e, convo.id)}
                                    onBlur={() => handleSaveTitle(convo.id)} // Salva ao perder o foco
                                    autoFocus
                                    className="flex-1 bg-transparent text-white focus:outline-none border-b border-blue-500/50 text-sm py-0.5"
                                />
                            ) : (
                                <>
                                    <IoChatbubbleEllipsesOutline
                                        size={18}
                                        className={`flex-shrink-0 ${convo.id === activeConversationId ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-400'
                                            }`}
                                    />
                                    <span className="truncate flex-1">{convo.title}</span>
                                </>
                            )}

                            {/* Botões de ação aparecem no hover ou se for a conversa ativa, ou se estiver editando */}
                            {editingConversationId !== convo.id && (
                                <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150
                                [&>button]:p-1 [&>button]:rounded-md [&>button:hover]:bg-slate-700/70
                                ${convo.id === activeConversationId ? '!opacity-100 [&>button:hover]:!bg-blue-500/80' : ''}
                                ${editingConversationId === convo.id ? '!opacity-100' : ''}
                                ">
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
                                    {/* Botão de reticências para mais opções no futuro
                  <button title="Mais opções" aria-label="Mais opções para a conversa">
                    <IoEllipsisHorizontal size={18} />
                  </button>
                  */}
                                </div>
                            )}
                        </div>
                    ))}
                    {sortedConversations.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-4 px-2">
                            Seu histórico de conversas aparecerá aqui.
                        </p>
                    )}
                </div>
            </nav>

            <div className="pt-3 border-t border-slate-800">
                <button
                    onClick={onOpenSettings}
                    className="w-full text-left text-slate-300 hover:bg-slate-800 hover:text-slate-100 p-2.5 rounded-lg flex items-center space-x-3 transition-colors duration-150 ease-in-out text-sm"
                >
                    <IoSettingsOutline size={20} className="text-slate-400" />
                    <span>Configurações</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;