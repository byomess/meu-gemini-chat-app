import React, { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    IoClose,
    IoTrashOutline,
    IoPencilOutline,
    IoAddCircleOutline,
    IoKeyOutline,
    IoDownloadOutline,
    IoCloudUploadOutline,
    IoChatbubblesOutline,
    IoBuildOutline,
    IoCheckmarkOutline,
    IoTrashBinOutline,
} from 'react-icons/io5';
import Button from '../common/Button'; // Certifique-se que este caminho está correto
import { useAppSettings } from '../../contexts/AppSettingsContext'; // Certifique-se que este caminho está correto
import { useMemories } from '../../contexts/MemoryContext'; // Certifique-se que este caminho está correto
import { useConversations } from '../../contexts/ConversationContext'; // Certifique-se que este caminho está correto
import type { Memory, GeminiModel, GeminiModelConfig } from '../../types'; // Certifique-se que este caminho está correto
import { LuBrain } from 'react-icons/lu';
import { FiDatabase } from 'react-icons/fi';

const AVAILABLE_GEMINI_MODELS: GeminiModel[] = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash",
];

type TabId = 'general' | 'model' | 'memories' | 'data';

interface Tab {
    id: TabId;
    label: string;
    icon: React.ReactElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.FC<any>;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const RangeInput: React.FC<{
    id: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
    info?: string;
    disabled?: boolean;
}> = ({ id, label, min, max, step, value, onChange, info, disabled = false }) => (
    <div className="mb-5 last:mb-0">
        <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={id} className={`block text-sm font-medium ${disabled ? 'text-slate-500' : 'text-slate-200'}`}>
                {label}
            </label>
            <span className={`text-xs px-2 py-1 rounded-md ${disabled ? 'text-slate-600 bg-slate-800/70' : 'text-sky-200 bg-sky-700/50'}`}>{value.toFixed(id === 'temperature' || id === 'topP' ? 2 : 0)}</span>
        </div>
        <input
            type="range"
            id={id}
            name={id}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            disabled={disabled}
            className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer transition-opacity
                        ${disabled 
                            ? 'bg-slate-700/70 opacity-60 cursor-not-allowed' 
                            : 'bg-slate-600/80 accent-sky-500 hover:opacity-90'
                        }`}
        />
        {info && <p className={`text-xs mt-1.5 ${disabled ? 'text-slate-600' : 'text-slate-400/90'}`}>{info}</p>}
    </div>
);


const GeneralSettingsTab: React.FC<{
    currentApiKey: string;
    setCurrentApiKey: (key: string) => void;
}> = ({ currentApiKey, setCurrentApiKey }) => {
    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-slate-200 mb-1.5">
                    Chave da API Google Gemini
                </label>
                <input
                    type="password"
                    id="apiKey"
                    name="apiKey"
                    placeholder="Cole sua chave da API aqui (ex: AIza...)"
                    value={currentApiKey}
                    onChange={(e) => setCurrentApiKey(e.target.value)}
                    className="w-full p-3 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-500 text-slate-100 shadow-sm transition-colors"
                />
                <p className="text-xs text-slate-400/90 mt-2">
                    Sua chave de API é armazenada localmente no seu navegador e nunca é enviada para nossos servidores.
                </p>
            </div>
        </div>
    );
};

const ModelSettingsTab: React.FC<{
    currentModelConfig: GeminiModelConfig;
    onModelConfigChange: (field: keyof GeminiModelConfig, value: unknown) => void;
}> = ({ currentModelConfig, onModelConfigChange }) => {
    return (
        <div className="space-y-5">
            <div>
                <label htmlFor="modelName" className="block text-sm font-medium text-slate-200 mb-1.5">
                    Modelo Gemini
                </label>
                <select
                    id="modelName"
                    name="modelName"
                    value={currentModelConfig.model}
                    onChange={(e) => onModelConfigChange('model', e.target.value as GeminiModel)}
                    className="w-full p-3 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-2 focus:ring-sky-500/80 focus:border-sky-500 text-slate-100 shadow-sm appearance-none bg-no-repeat bg-right pr-8"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundSize: '1.5em 1.5em', backgroundPosition: 'right 0.5rem center' }}
                >
                    {AVAILABLE_GEMINI_MODELS.map(model => (
                        <option key={model} value={model} className="bg-slate-800 text-slate-100">{model}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-400/90 mt-2">
                    Escolha o modelo Gemini. "Flash" é mais rápido, "Pro" é mais capaz.
                </p>
            </div>

            <RangeInput
                id="temperature"
                label="Temperatura"
                min={0.0}
                max={2.0}
                step={0.05}
                value={currentModelConfig.temperature}
                onChange={(value) => onModelConfigChange('temperature', value)}
                info="Controla a aleatoriedade. Mais alto = mais criativo/aleatório."
            />

            <RangeInput
                id="topP"
                label="Top P"
                min={0.0}
                max={1.0}
                step={0.01}
                value={currentModelConfig.topP}
                onChange={(value) => onModelConfigChange('topP', value)}
                info="Considera tokens com probabilidade cumulativa até este valor."
            />
            
            <RangeInput
                id="topK"
                label="Top K"
                min={0} 
                max={120} 
                step={1}
                value={currentModelConfig.topK}
                onChange={(value) => onModelConfigChange('topK', value)}
                info="Considera os K tokens mais prováveis. (0 desativa)"
            />

            <div>
                 <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-slate-200 mb-1.5">
                    Máximo de Tokens de Saída
                </label>
                <input
                    type="number"
                    id="maxOutputTokens"
                    name="maxOutputTokens"
                    min="1"
                    max={currentModelConfig.model.includes('flash') ? 8192 : (currentModelConfig.model.includes('pro') ? 32768 : 8192)} // Ajuste conforme o modelo
                    step="1024"
                    value={currentModelConfig.maxOutputTokens}
                    onChange={(e) => onModelConfigChange('maxOutputTokens', parseInt(e.target.value, 10) || 1)}
                    className="w-full p-3 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-100 shadow-sm"
                />
                <p className="text-xs text-slate-400/90 mt-2">
                    Limite de tokens na resposta da IA. (Ex: 8192 para Flash, até 32768 para Pro)
                </p>
            </div>
        </div>
    );
};

const MemoriesSettingsTab: React.FC = () => {
    const { memories, addMemory, deleteMemory, updateMemory, replaceAllMemories } = useMemories();
    const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
    const [editedMemoryText, setEditedMemoryText] = useState<string>('');
    const [newMemoryText, setNewMemoryText] = useState<string>('');
    const newMemoryInputRef = useRef<HTMLInputElement>(null);
    const editMemoryInputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingMemory && editMemoryInputRef.current) {
            editMemoryInputRef.current.focus();
            editMemoryInputRef.current.select();
        }
    }, [editingMemory]);

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
        if (editingMemory && editedMemoryText.trim()) {
            if (editedMemoryText.trim() !== editingMemory.content) {
                updateMemory(editingMemory.id, editedMemoryText.trim());
            }
            setEditingMemory(null);
            setEditedMemoryText('');
        } else if (editingMemory && !editedMemoryText.trim()) {
            alert("O conteúdo da memória não pode ser vazio.");
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
        if (e.key === 'Enter') { e.preventDefault(); handleAddNewMemory(); }
    };
    
    const handleEditMemoryKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveMemoryEdit(); } // Salvar com Enter
        else if (e.key === 'Escape') { e.preventDefault(); handleCancelMemoryEdit(); }
    };

    const handleExportMemories = () => {
        if (memories.length === 0) { alert("Nenhuma memória para exportar."); return; }
        const jsonString = JSON.stringify(memories, null, 2);
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
                    if (Array.isArray(importedMemories) && importedMemories.every(mem => typeof mem.id === 'string' && typeof mem.content === 'string' && typeof mem.timestamp === 'string')) {
                        if (window.confirm(`Isso substituirá ${memories.length > 0 ? 'TODAS as memórias atuais' : 'suas memórias (atualmente vazias)'} por ${importedMemories.length} memórias do arquivo. Deseja continuar?`)) {
                            replaceAllMemories(importedMemories.map(mem => ({...mem, timestamp: new Date(mem.timestamp) })));
                        }
                    } else { throw new Error("O arquivo JSON não contém um array de memórias válidas (cada memória deve ter 'id', 'content', 'timestamp')."); }
                }
            } catch (error) {
                console.error("Erro ao importar memórias:", error);
                alert(`Erro ao importar memórias: ${error instanceof Error ? error.message : "Formato de arquivo inválido."}`);
            } finally { if (fileInputRef.current) { fileInputRef.current.value = ""; } }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3 mb-1">
                <h3 className="text-base font-semibold text-slate-100 w-full sm:w-auto">Gerenciar Memórias</h3>
                <div className="flex gap-2.5 flex-wrap">
                    <Button variant="secondary" className="!text-xs !py-2 !px-3.5 !font-medium !bg-slate-600/70 hover:!bg-slate-600" onClick={handleExportMemories} disabled={memories.length === 0}> <IoDownloadOutline className="mr-1.5" /> Exportar </Button>
                    <Button variant="secondary" className="!text-xs !py-2 !px-3.5 !font-medium !bg-slate-600/70 hover:!bg-slate-600" onClick={() => fileInputRef.current?.click()}> <IoCloudUploadOutline className="mr-1.5" /> Importar </Button>
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportMemories} className="hidden"/>
                </div>
            </div>

            <div className="flex items-center gap-2.5">
                <input ref={newMemoryInputRef} type="text" value={newMemoryText} onChange={(e) => setNewMemoryText(e.target.value)} onKeyDown={handleNewMemoryKeyDown} placeholder="Adicionar nova memória..." className="flex-grow p-2.5 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500 placeholder-slate-400 text-sm text-slate-100 transition-colors"/>
                <Button variant="primary" onClick={handleAddNewMemory} className="!py-2.5 !px-3 !bg-teal-600 hover:!bg-teal-500 active:!bg-teal-700 text-white flex-shrink-0" disabled={!newMemoryText.trim()}> <IoAddCircleOutline size={20} /> </Button>
            </div>

            {memories.length > 0 ? (
                <div className="overflow-y-auto space-y-2 p-3 bg-slate-900/60 rounded-lg scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800/50 border border-slate-700/60 max-h-[calc(100vh-420px)] sm:max-h-[calc(100vh-380px)] min-h-[100px]">
                    {memories.slice().reverse().map((memory) => (
                        <div key={memory.id} className="p-2.5 bg-slate-700/80 rounded-md shadow transition-shadow hover:shadow-md">
                            {editingMemory?.id === memory.id ? (
                                <div className="flex flex-col gap-2">
                                    <textarea value={editedMemoryText} onChange={(e) => setEditedMemoryText(e.target.value)} onKeyDown={handleEditMemoryKeyDown} ref={editMemoryInputRef} rows={3} className="w-full p-2 bg-slate-600/70 border border-slate-500/80 rounded text-xs text-slate-100 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-y min-h-[40px] scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-600/50"/>
                                    <div className="flex justify-end gap-1.5">
                                        <Button variant="secondary" onClick={handleCancelMemoryEdit} className="!text-xs !py-1 !px-2.5 !bg-slate-500/80 hover:!bg-slate-500">Cancelar</Button>
                                        <Button variant="primary" onClick={handleSaveMemoryEdit} className="!text-xs !py-1 !px-2.5 !bg-sky-600 hover:!bg-sky-500">Salvar</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs text-slate-200 flex-grow break-words py-0.5 pr-1 whitespace-pre-wrap">{memory.content}</p>
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                        <Button variant="icon" className="!p-1.5 text-slate-400 hover:!text-sky-400 hover:!bg-slate-600/60" title="Editar memória" onClick={() => handleStartEditMemory(memory)}> <IoPencilOutline size={15} /> </Button>
                                        <Button variant="icon" className="!p-1.5 text-slate-400 hover:!text-red-400 hover:!bg-slate-600/60" title="Excluir memória" onClick={() => handleLocalDeleteMemory(memory.id)}> <IoTrashBinOutline size={15} /> </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-4 text-center bg-slate-900/60 rounded-lg border border-slate-700/60">
                    <LuBrain size={28} className="mx-auto text-slate-500 mb-2" />
                    <p className="text-sm text-slate-400">Nenhuma memória armazenada.</p>
                    <p className="text-xs text-slate-500 mt-1">Adicione memórias para personalizar suas interações.</p>
                </div>
            )}
        </div>
    );
};

const DataSettingsTab: React.FC = () => {
    const { clearAllMemories, memories } = useMemories();
    const { deleteAllConversations, conversations } = useConversations(); 

    const handleLocalClearAllMemories = () => {
        if (window.confirm('Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita.')) {
            clearAllMemories();
        }
    };

    const handleLocalDeleteAllConversations = () => {
        if (window.confirm('Tem certeza de que deseja apagar TODAS as conversas? Esta ação não pode ser desfeita e apagará todo o seu histórico.')) {
            deleteAllConversations();
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-slate-100 mb-3">Gerenciamento de Dados</h3>
                <div className="p-4 bg-slate-700/60 rounded-lg border border-slate-600/70 space-y-4 shadow">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-slate-100">Apagar todas as memórias</p>
                            <p className="text-xs text-slate-400/90 mt-0.5">Remove todas as memórias armazenadas pela IA.</p>
                        </div>
                        <Button variant="danger" className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-auto" onClick={handleLocalClearAllMemories} disabled={memories.length === 0}> <IoTrashOutline className="mr-1.5" /> Limpar Memórias </Button>
                    </div>
                    <hr className="border-slate-600/80 my-3" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-slate-100">Apagar todas as conversas</p>
                            <p className="text-xs text-slate-400/90 mt-0.5">Remove todo o seu histórico de conversas.</p>
                        </div>
                        <Button variant="danger" className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-auto" onClick={handleLocalDeleteAllConversations} disabled={conversations.length === 0}> <IoChatbubblesOutline className="mr-1.5" /> Limpar Conversas </Button>
                    </div>
                </div>
                 <p className="text-xs text-slate-500 mt-4 text-center">
                    Todas as ações de exclusão de dados são irreversíveis.
                </p>
            </div>
        </div>
    );
};


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { settings, setSettings } = useAppSettings();
    const [currentApiKey, setCurrentApiKey] = useState<string>('');
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const modalContentRef = useRef<HTMLDivElement>(null);
    // Para controlar a direção da animação de slide (opcional)
    const [previousTab, setPreviousTab] = useState<TabId | null>(null);

    const defaultModelConfig = useMemo((): GeminiModelConfig => {
        const defaultFirstModel = AVAILABLE_GEMINI_MODELS[0] || "gemini-2.5-flash-preview-04-17";
        return {
            model: defaultFirstModel,
            temperature: 0.90,
            topP: 0.95,
            topK: 8,
            maxOutputTokens: defaultFirstModel.includes('flash') ? 8192 : (defaultFirstModel.includes('pro') ? 32768 : 8192),
        };
    }, []);

    const [localModelConfig, setLocalModelConfig] = useState<GeminiModelConfig>(
        settings.geminiModelConfig || defaultModelConfig
    );

    useEffect(() => {
        if (isOpen) {
            setCurrentApiKey(settings.apiKey || '');
            setLocalModelConfig(settings.geminiModelConfig || defaultModelConfig);
        }
    }, [isOpen, settings, defaultModelConfig]);

    useEffect(() => {
        if (isOpen) {
            setPreviousTab(null); // Reseta o previousTab ao abrir o modal
            setActiveTab('general');
        }
    }, [isOpen]);

    const handleTabChange = (newTabId: TabId) => {
        setPreviousTab(activeTab); // Guarda a aba atual antes de mudar
        setActiveTab(newTabId);
    };

    const handleLocalModelConfigChange = (field: keyof GeminiModelConfig, value: string | number | GeminiModel) => {
        setLocalModelConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveAllSettings = () => {
        if (localModelConfig.temperature < 0 || localModelConfig.temperature > 2) { alert("A temperatura deve estar entre 0.0 e 2.0."); return; }
        if (localModelConfig.topP < 0 || localModelConfig.topP > 1) { alert("Top P deve estar entre 0.0 e 1.0."); return; }
        if (localModelConfig.topK < 0) { alert("Top K não pode ser negativo."); return; }
        if (localModelConfig.maxOutputTokens < 1) { alert("Máximo de Tokens de Saída deve ser pelo menos 1."); return; }

        setSettings(prevSettings => ({ ...prevSettings, apiKey: currentApiKey, geminiModelConfig: localModelConfig }));
        alert("Configurações salvas com sucesso!");
    };

    const tabs: Tab[] = [
        { id: 'general', label: 'Geral', icon: <IoKeyOutline size={18} className="opacity-80" />, component: GeneralSettingsTab },
        { id: 'model', label: 'Modelo IA', icon: <IoBuildOutline size={18} className="opacity-80" />, component: ModelSettingsTab },
        { id: 'memories', label: 'Memórias', icon: <LuBrain size={18} className="opacity-80" />, component: MemoriesSettingsTab },
        { id: 'data', label: 'Dados', icon: <FiDatabase size={17} className="opacity-80" />, component: DataSettingsTab },
    ];

    // Encontra o índice da aba ativa e da aba anterior para determinar a direção do slide
    const activeTabIndex = tabs.findIndex(tab => tab.id === activeTab);
    const previousTabIndex = previousTab ? tabs.findIndex(tab => tab.id === previousTab) : -1;
    const slideDirection = previousTabIndex === -1 || activeTabIndex === previousTabIndex 
        ? 0 // sem slide ou slide inicial
        : activeTabIndex > previousTabIndex ? 1 : -1; // 1 para direita, -1 para esquerda


    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose} initialFocus={modalContentRef}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translate-y-8 sm:translate-y-4"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-8 sm:translate-y-4"
                        >
                            <Dialog.Panel
                                ref={modalContentRef}
                                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-3xl text-slate-100 relative h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden border border-slate-700/70 text-left transform transition-all"
                            >
                                <div className="flex items-center justify-between p-4 pr-12 sm:p-5 sm:pr-14 border-b border-slate-700/60 flex-shrink-0 relative bg-slate-800/50">
                                    <Dialog.Title as="h2" className="text-lg font-semibold text-slate-100">
                                        Configurações do Aplicativo
                                    </Dialog.Title>
                                    <Button onClick={onClose} className="!absolute top-1/2 -translate-y-1/2 right-3 !p-2 text-slate-400 hover:text-slate-100 rounded-full hover:!bg-slate-700/80 z-10" variant="icon" aria-label="Fechar modal"> <IoClose size={24} /> </Button>
                                </div>
                                
                                <div className="flex flex-col md:flex-row flex-grow min-h-0">
                                    <nav className="w-full md:w-52 flex-shrink-0 flex md:flex-col bg-slate-800/30 md:bg-slate-850/50 p-2 md:p-3 space-x-1 md:space-x-0 md:space-y-1.5 border-b md:border-b-0 md:border-r border-slate-700/60 overflow-x-auto md:overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                        {tabs.map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => handleTabChange(tab.id)} // Alterado para handleTabChange
                                                className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group whitespace-nowrap flex-shrink-0
                                                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800
                                                            ${activeTab === tab.id
                                                                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md scale-[1.02]'
                                                                : 'text-slate-300 hover:bg-slate-700/70 hover:text-slate-50 active:scale-[0.98]'
                                                            }`}
                                                style={{ flex: '0 0 auto' }}
                                            >
                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                {React.cloneElement(tab.icon as React.ReactElement<any>, { className: `transition-transform duration-200 ${activeTab === tab.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}` })}
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </nav>

                                    <div className="flex flex-col flex-grow min-h-0 bg-slate-800/20 relative overflow-hidden"> {/* Adicionado relative e overflow-hidden aqui */}
                                        <div className="flex-grow p-4 sm:p-5 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600/80 scrollbar-track-slate-700/50 scrollbar-thumb-rounded-full">
                                            {/* Animação para a troca de abas */}
                                            {tabs.map((tab) => {
                                                const TabComponent = tab.component;
                                                const isTabActive = activeTab === tab.id;
                                                
                                                // Determina a animação de entrada e saída com base na direção do slide
                                                let enterFromClass = "opacity-0";
                                                let leaveToClass = "opacity-0";

                                                if (slideDirection !== 0) { // Apenas aplicar slide se houver direção
                                                    enterFromClass += slideDirection > 0 ? " translate-x-20" : " -translate-x-20";
                                                    leaveToClass += slideDirection > 0 ? " -translate-x-20" : " translate-x-20";
                                                }
                                                
                                                return (
                                                    <Transition
                                                        key={tab.id} // A chave é importante para o Transition identificar a mudança
                                                        show={isTabActive}
                                                        as={Fragment} // Para não renderizar um div extra
                                                        enter="transition-all ease-in-out duration-300 transform"
                                                        enterFrom={enterFromClass}
                                                        enterTo="opacity-100 translate-x-0"
                                                        leave="transition-all ease-in-out duration-300 transform absolute inset-0" // Absolute para sobrepor durante a saída
                                                        leaveFrom="opacity-100 translate-x-0"
                                                        leaveTo={leaveToClass}
                                                    >
                                                        {/* O div abaixo garante que a transição tenha um elemento para aplicar as classes */}
                                                        <div className={`w-full h-full ${isTabActive ? '' : 'hidden'}`}>
                                                            <TabComponent
                                                                {...(tab.id === 'general' && { currentApiKey, setCurrentApiKey })}
                                                                {...(tab.id === 'model' && { currentModelConfig: localModelConfig, onModelConfigChange: handleLocalModelConfigChange })}
                                                            />
                                                        </div>
                                                    </Transition>
                                                );
                                            })}
                                        </div>
                                        <div className="p-4 border-t border-slate-700/60 flex-shrink-0 bg-slate-800/50 flex justify-end">
                                            <Button variant="primary" onClick={handleSaveAllSettings} className="!py-2.5 !px-5 !font-semibold !bg-sky-600 hover:!bg-sky-500 active:!bg-sky-700 shadow-md hover:shadow-lg transform active:scale-[0.98] transition-all">
                                                <IoCheckmarkOutline size={18} className="mr-1.5"/>
                                                Salvar Configurações
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default SettingsModal;