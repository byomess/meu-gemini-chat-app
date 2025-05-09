// src/components/settings/SettingsModal.tsx
import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import {
    IoClose,
    IoTrashOutline,
    IoInformationCircleOutline,
    IoPencilOutline,
    IoAddCircleOutline,
    IoKeyOutline,
    IoDownloadOutline, // Ícone para Exportar
    IoCloudUploadOutline, // Ícone para Importar
} from 'react-icons/io5';
import Button from '../common/Button';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import type { Memory } from '../../types';
import { LuBrain } from 'react-icons/lu';

type TabId = 'general' | 'memories';

interface Tab {
    id: TabId;
    label: string;
    icon: ReactNode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.FC<any>;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GeneralSettingsTab: React.FC<{
    currentApiKey: string;
    setCurrentApiKey: (key: string) => void;
    onSaveApiKey: () => void;
}> = ({ currentApiKey, setCurrentApiKey, onSaveApiKey }) => {
    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Chave da API Google Gemini
                </label>
                <div className="flex gap-2">
                    <input
                        type="password"
                        id="apiKey"
                        name="apiKey"
                        placeholder="Cole sua chave da API aqui"
                        value={currentApiKey}
                        onChange={(e) => setCurrentApiKey(e.target.value)}
                        className="flex-grow p-2.5 bg-slate-700/80 border border-slate-600/80 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500 text-slate-100 shadow-sm"
                    />
                    <Button variant="primary" onClick={onSaveApiKey} className="!py-2.5 flex-shrink-0">Salvar Chave</Button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    Sua chave de API é armazenada localmente.
                </p>
            </div>
        </div>
    );
};

const MemoriesSettingsTab: React.FC = () => {
    const { memories, addMemory, deleteMemory, updateMemory, clearAllMemories, replaceAllMemories } = useMemories();
    const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
    const [editedMemoryText, setEditedMemoryText] = useState<string>('');
    const [newMemoryText, setNewMemoryText] = useState<string>('');
    const newMemoryInputRef = useRef<HTMLInputElement>(null);
    const editMemoryInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null); // Para o input de arquivo

    useEffect(() => {
        if (editingMemory && editMemoryInputRef.current) {
            editMemoryInputRef.current.focus();
            editMemoryInputRef.current.select();
        }
    }, [editingMemory]);

    const handleLocalClearAllMemories = () => {
        clearAllMemories(); // A confirmação já está no contexto
    };

    const handleLocalDeleteMemory = (id: string) => {
        if (window.confirm('Tem certeza de que deseja apagar esta memória?')) {
            deleteMemory(id);
            if (editingMemory?.id === id) {
                setEditingMemory(null);
                setEditedMemoryText('');
            }
        }
    };

    const handleStartEditMemory = (memory: Memory) => {
        setEditingMemory(memory);
        setEditedMemoryText(memory.content);
    };

    const handleSaveMemoryEdit = () => {
        if (editingMemory) { // Garante que editingMemory não é null
            if (editedMemoryText.trim() !== editingMemory.content) {
                updateMemory(editingMemory.id, editedMemoryText.trim()); // updateMemory lida com texto vazio
            }
            setEditingMemory(null);
            setEditedMemoryText('');
        }
    };
    
    const handleCancelMemoryEdit = () => {
        setEditingMemory(null);
        setEditedMemoryText('');
    };

    const handleAddNewMemory = () => {
        if (newMemoryText.trim()) {
            addMemory(newMemoryText.trim());
            setNewMemoryText('');
            if (newMemoryInputRef.current) {
                newMemoryInputRef.current.focus();
            }
        }
    };

    const handleNewMemoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddNewMemory();
        }
    };
    
    const handleEditMemoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveMemoryEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelMemoryEdit();
        }
    };

    const handleExportMemories = () => {
        if (memories.length === 0) {
            alert("Nenhuma memória para exportar.");
            return;
        }
        const jsonString = JSON.stringify(memories, null, 4); // null, 4 para formatação bonita
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `gemini_chat_memories_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportMemories = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result;
                if (typeof content === 'string') {
                    const importedMemories = JSON.parse(content) as Memory[];
                    if (Array.isArray(importedMemories)) {
                        if (window.confirm(`Isso substituirá todas as memórias atuais por ${importedMemories.length} memórias do arquivo. Deseja continuar?`)) {
                            replaceAllMemories(importedMemories);
                        }
                    } else {
                        throw new Error("O arquivo JSON não contém um array de memórias.");
                    }
                }
            } catch (error) {
                console.error("Erro ao importar memórias:", error);
                alert(`Erro ao importar memórias: ${error instanceof Error ? error.message : "Formato de arquivo inválido."}`);
            } finally {
                // Resetar o valor do input para permitir o re-upload do mesmo arquivo
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };


    return (
        <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-base font-medium text-slate-300">Gerenciar Memórias</h3>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="secondary"
                        className="!text-xs !py-1.5 !px-3 !font-normal"
                        onClick={handleExportMemories}
                        disabled={memories.length === 0}
                    >
                        <IoDownloadOutline className="mr-1.5 inline" />
                        Exportar
                    </Button>
                    <Button
                        variant="secondary"
                        className="!text-xs !py-1.5 !px-3 !font-normal"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <IoCloudUploadOutline className="mr-1.5 inline" />
                        Importar
                    </Button>
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleImportMemories}
                        className="hidden"
                    />
                    {memories.length > 0 && (
                        <Button
                            variant="danger"
                            className="!text-xs !py-1.5 !px-3 !font-normal"
                            onClick={handleLocalClearAllMemories}
                        >
                            <IoTrashOutline className="mr-1.5 inline" />
                            Limpar Tudo
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex gap-2">
                <input
                    ref={newMemoryInputRef}
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    onKeyDown={handleNewMemoryKeyDown}
                    placeholder="Adicionar nova memória personalizada..."
                    className="flex-grow p-2 bg-slate-700/60 border border-slate-600/70 rounded-md focus:ring-1 focus:ring-teal-500 placeholder-slate-500 text-sm"
                />
                <Button
                    variant="secondary"
                    onClick={handleAddNewMemory}
                    className="!py-2 !px-2.5 bg-teal-600 hover:bg-teal-500 text-white flex-shrink-0"
                    disabled={!newMemoryText.trim()}
                >
                    <IoAddCircleOutline size={18} />
                </Button>
            </div>

            {memories.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-900/50 rounded-md scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent border border-slate-700/40">
                    {memories.map((memory) => (
                        <div
                            key={memory.id}
                            className="p-2 bg-slate-700/70 rounded"
                        >
                            {editingMemory?.id === memory.id ? (
                                <div className="flex flex-col gap-1.5">
                                    <input
                                        ref={editMemoryInputRef}
                                        type="text"
                                        value={editedMemoryText}
                                        onChange={(e) => setEditedMemoryText(e.target.value)}
                                        onKeyDown={handleEditMemoryKeyDown}
                                        className="w-full p-1.5 bg-slate-600 border border-slate-500 rounded text-xs text-slate-100"
                                    />
                                    <div className="flex justify-end gap-1">
                                        <Button variant="secondary" onClick={handleCancelMemoryEdit} className="!text-xs !py-0.5 !px-1.5">Cancelar</Button>
                                        <Button variant="primary" onClick={handleSaveMemoryEdit} className="!text-xs !py-0.5 !px-1.5">Salvar</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-slate-200 flex-grow break-all">{memory.content}</p>
                                    <div className="flex-shrink-0 flex gap-1">
                                        <Button
                                            variant="secondary"
                                            className="!p-1 !text-xs text-slate-400 hover:text-blue-400"
                                            title="Editar memória"
                                            onClick={() => handleStartEditMemory(memory)}
                                        >
                                            <IoPencilOutline size={14} />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="!p-1 !text-xs text-slate-400 hover:text-red-400"
                                            title="Excluir memória"
                                            onClick={() => handleLocalDeleteMemory(memory.id)}
                                        >
                                            <IoTrashOutline size={14} />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-3 text-center bg-slate-900/50 rounded-md border border-slate-700/40">
                    <IoInformationCircleOutline size={24} className="mx-auto text-slate-500 mb-1.5" />
                    <p className="text-xs text-slate-400">Nenhuma memória armazenada.</p>
                </div>
            )}
        </div>
    );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { settings, saveApiKey } = useAppSettings();
    const [currentApiKey, setCurrentApiKey] = useState<string>('');
    const [activeTab, setActiveTab] = useState<TabId>('general');

    useEffect(() => {
        if (isOpen) {
            setCurrentApiKey(settings.apiKey);
            setActiveTab('general');
        }
    }, [settings.apiKey, isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSaveApiKeyOnly = () => {
        saveApiKey(currentApiKey);
        alert("Chave de API salva!"); // Feedback simples
    };
    
    const handleFinalSaveAndClose = () => {
        saveApiKey(currentApiKey);
        onClose();
    };

    const tabs: Tab[] = [
        { id: 'general', label: 'Geral', icon: <IoKeyOutline size={18} />, component: GeneralSettingsTab },
        { id: 'memories', label: 'Memórias', icon: <LuBrain size={18} />, component: MemoriesSettingsTab },
    ];

    const ActiveTabComponent = tabs.find(tab => tab.id === activeTab)?.component;

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl text-slate-100 relative animate-modalEnter max-h-[90vh] flex flex-col">
                <Button
                    onClick={onClose}
                    className="!absolute top-3.5 right-3.5 !p-1.5 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-700/70 z-30"
                    variant="secondary"
                    aria-label="Fechar modal de configurações"
                >
                    <IoClose size={22} />
                </Button>

                <div className="flex flex-grow min-h-0">
                    <nav className="w-48 flex-shrink-0 bg-slate-850 p-4 space-y-2 border-r border-slate-700/50 rounded-l-xl">
                        <h2 className="text-lg font-semibold mb-4 px-1 text-slate-200">Configurações</h2>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center space-x-2.5 p-2.5 rounded-md text-sm font-medium transition-colors
                                            ${activeTab === tab.id
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                            }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="flex-grow p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50">
                        {ActiveTabComponent && (
                            <ActiveTabComponent
                                {...(activeTab === 'general' && { currentApiKey, setCurrentApiKey, onSaveApiKey: handleSaveApiKeyOnly })}
                            />
                        )}
                    </div>
                </div>
                
                <div className="flex-shrink-0 p-4 border-t border-slate-700/50 flex justify-end space-x-3 bg-slate-800 rounded-b-xl">
                    <Button variant="secondary" onClick={onClose} className="!py-2">
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={handleFinalSaveAndClose} className="!py-2">
                        Concluir
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;