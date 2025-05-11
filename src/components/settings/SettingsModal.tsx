// src/components/settings/SettingsModal.tsx
import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import {
    IoClose,
    IoTrashOutline,
    IoInformationCircleOutline,
    IoPencilOutline,
    IoAddCircleOutline,
    IoKeyOutline,
    IoDownloadOutline,
    IoCloudUploadOutline,
    IoChatbubblesOutline, // Para apagar conversas
    IoBuildOutline,       // Novo ícone para a aba de Modelo
} from 'react-icons/io5';
import Button from '../common/Button';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import { useConversations } from '../../contexts/ConversationContext';
import type { Memory, GeminiModel, GeminiModelConfig } from '../../types'; // Importar AppSettings, GeminiModel, GeminiModelConfig
import { LuBrain } from 'react-icons/lu';
import { FiDatabase } from 'react-icons/fi';

// Lista de modelos disponíveis (deve corresponder ao seu `types/index.ts` ou similar)
const AVAILABLE_GEMINI_MODELS: GeminiModel[] = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash", // Ajuste esta lista conforme seus tipos
    // Adicione outros modelos suportados aqui se necessário
    // "gemini-1.5-pro-latest",
    // "gemini-1.5-flash-latest",
    // "gemini-pro",
];

type TabId = 'general' | 'model' | 'memories' | 'data'; // Adicionada a aba 'model'

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

// Componente reutilizável para input de range
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
    <div>
        <div className="flex justify-between items-center mb-1">
            <label htmlFor={id} className={`block text-sm font-medium ${disabled ? 'text-slate-500' : 'text-slate-300'}`}>
                {label}
            </label>
            <span className={`text-xs px-1.5 py-0.5 rounded-md ${disabled ? 'text-slate-600 bg-slate-800' : 'text-slate-400 bg-slate-700'}`}>{value}</span>
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
            className={`w-full h-2 rounded-lg appearance-none ${disabled ? 'bg-slate-700 cursor-not-allowed' : 'bg-slate-600 cursor-pointer accent-blue-500'}`}
        />
        {info && <p className={`text-xs mt-1 ${disabled ? 'text-slate-600' : 'text-slate-500'}`}>{info}</p>}
    </div>
);


const GeneralSettingsTab: React.FC<{
    currentApiKey: string;
    setCurrentApiKey: (key: string) => void;
    // onSaveApiKey: () => void; // Será tratado pelo botão Salvar Configurações geral
}> = ({ currentApiKey, setCurrentApiKey /*, onSaveApiKey */ }) => {
    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Chave da API Google Gemini
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="password"
                        id="apiKey"
                        name="apiKey"
                        placeholder="Cole sua chave da API aqui"
                        value={currentApiKey}
                        onChange={(e) => setCurrentApiKey(e.target.value)}
                        className="flex-grow p-2.5 bg-slate-700/80 border border-slate-600/80 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500 text-slate-100 shadow-sm w-full"
                    />
                    {/* O botão de salvar API Key individual foi removido, pois haverá um Salvar Configurações geral */}
                    {/* <Button variant="primary" onClick={onSaveApiKey} className="!py-2.5 flex-shrink-0 w-full sm:w-auto">Salvar Chave</Button> */}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    Sua chave de API é armazenada localmente no seu navegador.
                </p>
            </div>
             {/* Você pode adicionar outras configurações gerais aqui, como Tema, etc. */}
        </div>
    );
};

// Nova aba para configurações do modelo
const ModelSettingsTab: React.FC<{
    currentModelConfig: GeminiModelConfig; // Recebe a configuração atual do modelo
    onModelConfigChange: (field: keyof GeminiModelConfig, value: unknown) => void; // Função para atualizar um campo
}> = ({ currentModelConfig, onModelConfigChange }) => {
    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="modelName" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Modelo Gemini
                </label>
                <select
                    id="modelName"
                    name="modelName"
                    value={currentModelConfig.model}
                    onChange={(e) => onModelConfigChange('model', e.target.value as GeminiModel)}
                    className="w-full p-2.5 bg-slate-700/80 border border-slate-600/80 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-100 shadow-sm"
                >
                    {AVAILABLE_GEMINI_MODELS.map(model => (
                        <option key={model} value={model}>{model}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">
                    Escolha o modelo Gemini. Verifique a documentação para compatibilidade e capacidades.
                </p>
            </div>

            <RangeInput
                id="temperature"
                label="Temperatura"
                min={0.0}
                max={2.0} // Alguns modelos Gemini 1.5+ suportam até 2.0
                step={0.01}
                value={currentModelConfig.temperature}
                onChange={(value) => onModelConfigChange('temperature', value)}
                info="Controla a aleatoriedade. Mais alto = mais criativo/aleatório. (Ex: 0.7)"
            />

            <RangeInput
                id="topP"
                label="Top P"
                min={0.0}
                max={1.0}
                step={0.01}
                value={currentModelConfig.topP}
                onChange={(value) => onModelConfigChange('topP', value)}
                info="Considera tokens com probabilidade cumulativa até este valor. (Ex: 0.95)"
            />
            
            <RangeInput
                id="topK"
                label="Top K"
                min={0} // 0 ou 1 geralmente desativa Top K se Top P estiver ativo.
                max={100} 
                step={1}
                value={currentModelConfig.topK}
                onChange={(value) => onModelConfigChange('topK', value)}
                info="Considera os K tokens mais prováveis. (Ex: 40, ou 1 se Top P é usado)"
            />

            <div>
                 <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Máximo de Tokens de Saída
                </label>
                <input
                    type="number"
                    id="maxOutputTokens"
                    name="maxOutputTokens"
                    min="1"
                    // O limite real pode variar por modelo, mas 8192 é comum para Pro, e Flash pode ser menos.
                    // Gemini 1.5 pode ter limites muito maiores (ex: 32768, 65536 ou até mais para contexto)
                    // Max Output Tokens é diferente de Context Window.
                    max={65536} // Um limite superior razoável para o input
                    step="128" // Passos maiores podem ser úteis
                    value={currentModelConfig.maxOutputTokens}
                    onChange={(e) => onModelConfigChange('maxOutputTokens', parseInt(e.target.value, 10) || 1)} // Evita NaN
                    className="w-full p-2.5 bg-slate-700/80 border border-slate-600/80 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-100 shadow-sm"
                />
                <p className="text-xs text-slate-400 mt-2">
                    Limite de tokens na resposta da IA. (Ex: 8192)
                </p>
            </div>
        </div>
    );
};


const MemoriesSettingsTab: React.FC = () => {
    // ... (código do MemoriesSettingsTab como no seu último fornecimento - sem alterações aqui)
    const { memories, addMemory, deleteMemory, updateMemory, replaceAllMemories } = useMemories();
    const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
    const [editedMemoryText, setEditedMemoryText] = useState<string>('');
    const [newMemoryText, setNewMemoryText] = useState<string>('');
    const newMemoryInputRef = useRef<HTMLInputElement>(null);
    const editMemoryInputRef = useRef<HTMLInputElement>(null);
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
        if (editingMemory) {
            if (editedMemoryText.trim() !== editingMemory.content) {
                updateMemory(editingMemory.id, editedMemoryText.trim());
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
        const jsonString = JSON.stringify(memories, null, 4);
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
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="text-base font-medium text-slate-300 w-full sm:w-auto">Gerenciar Memórias</h3>
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
                </div>
            </div>

            <div className="flex items-center gap-2">
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
                <div className="overflow-y-auto space-y-1.5 p-2 bg-slate-900/50 rounded-md scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50 border border-slate-700/40 max-h-[calc(50vh-180px)] sm:max-h-[calc(60vh-200px)]">
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
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <p className="text-xs text-slate-200 flex-grow break-all w-full sm:w-auto">{memory.content}</p>
                                    <div className="flex-shrink-0 flex gap-1 self-end sm:self-center">
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

const DataSettingsTab: React.FC = () => {
    // ... (código do DataSettingsTab como no seu último fornecimento - sem alterações aqui)
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
                <h3 className="text-base font-medium text-slate-300 mb-3">Gerenciamento de Dados</h3>
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/50 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex-grow">
                            <p className="text-sm text-slate-200">Apagar todas as memórias</p>
                            <p className="text-xs text-slate-400">Remove todas as memórias armazenadas pela IA.</p>
                        </div>
                        <Button
                            variant="danger"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-auto mt-1 sm:mt-0"
                            onClick={handleLocalClearAllMemories}
                            disabled={memories.length === 0}
                        >
                            <IoTrashOutline className="mr-1.5 inline" />
                            Limpar Memórias
                        </Button>
                    </div>
                    <hr className="border-slate-600/70" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex-grow">
                            <p className="text-sm text-slate-200">Apagar todas as conversas</p>
                            <p className="text-xs text-slate-400">Remove todo o seu histórico de conversas.</p>
                        </div>
                        <Button
                            variant="danger"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-auto mt-1 sm:mt-0"
                            onClick={handleLocalDeleteAllConversations}
                            disabled={conversations.length === 0}
                        >
                            <IoChatbubblesOutline className="mr-1.5 inline" />
                            Limpar Conversas
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { settings, setSettings } = useAppSettings(); // Removido saveApiKey pois setSettings é mais geral
    const [currentApiKey, setCurrentApiKey] = useState<string>('');
    const [activeTab, setActiveTab] = useState<TabId>('general');

    // Estado local para as configurações do modelo, inicializado com os valores do contexto
    const [localModelConfig, setLocalModelConfig] = useState<GeminiModelConfig>(
        // Garante que geminiModelConfig exista e tenha valores padrão
        settings.geminiModelConfig || {
            model: AVAILABLE_GEMINI_MODELS[0],
            temperature: 0.7,
            topP: 1.0,
            topK: 1,
            maxOutputTokens: 32768,
        }
    );

    useEffect(() => {
        if (isOpen) {
            setCurrentApiKey(settings.apiKey || '');
            // Atualizar localModelConfig com os valores atuais de settings.geminiModelConfig quando o modal abrir
            // ou com defaults se settings.geminiModelConfig não estiver definido (para migração)
            setLocalModelConfig(
                settings.geminiModelConfig || {
                    model: AVAILABLE_GEMINI_MODELS[0],
                    temperature: 0.7,
                    topP: 1.0,
                    topK: 1,
                    maxOutputTokens: 32768,
                }
            );
            setActiveTab('general');
        }
    }, [settings, isOpen]); // Depender de settings completo

    if (!isOpen) {
        return null;
    }

    // Handler para quando um campo de configuração do modelo muda na aba "Modelo"
    const handleLocalModelConfigChange = (
        field: keyof GeminiModelConfig,
        value: string | number // Aceita string ou número, pois o select retorna string
    ) => {
        setLocalModelConfig(prev => ({
            ...prev,
            [field]: field === 'model' ? value : Number(value) // Converte para número se não for 'model'
        }));
    };

    // Handler para salvar todas as configurações (API Key + Modelo)
    const handleSaveAllSettings = () => {
        // Validação básica antes de salvar
        if (localModelConfig.temperature < 0 || localModelConfig.temperature > 2) {
            alert("A temperatura deve estar entre 0.0 e 2.0.");
            return;
        }
        if (localModelConfig.topP < 0 || localModelConfig.topP > 1) {
            alert("Top P deve estar entre 0.0 e 1.0.");
            return;
        }
        if (localModelConfig.topK < 0) {
            alert("Top K não pode ser negativo.");
            return;
        }
        if (localModelConfig.maxOutputTokens < 1) {
            alert("Máximo de Tokens de Saída deve ser pelo menos 1.");
            return;
        }

        setSettings(prevSettings => ({
            ...prevSettings,
            apiKey: currentApiKey,
            geminiModelConfig: localModelConfig, // Salva o estado local do modelConfig
        }));
        alert("Configurações salvas!");
        // onClose(); // Opcional: fechar modal após salvar
    };

    const tabs: Tab[] = [
        { id: 'general', label: 'Geral', icon: <IoKeyOutline size={18} />, component: GeneralSettingsTab },
        { id: 'model', label: 'Modelo', icon: <IoBuildOutline size={18} />, component: ModelSettingsTab }, // Nova aba
        { id: 'memories', label: 'Memórias', icon: <LuBrain size={18} />, component: MemoriesSettingsTab },
        { id: 'data', label: 'Dados', icon: <FiDatabase size={18} />, component: DataSettingsTab },
    ];

    const ActiveTabComponent = tabs.find(tab => tab.id === activeTab)?.component;

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl text-slate-100 relative animate-modalEnter h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden">
                
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-slate-200">Configurações</h2>
                </div>
                
                <Button
                    onClick={onClose}
                    className="!absolute top-3.5 right-3.5 !p-1.5 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-700/70 z-30"
                    variant="secondary"
                    aria-label="Fechar modal de configurações"
                >
                    <IoClose size={22} />
                </Button>

                <div className="flex flex-col md:flex-row flex-grow min-h-0">
                    <nav className="hidden md:flex w-48 flex-shrink-0 flex-col bg-slate-850 p-3 md:p-4 space-y-1 md:space-y-2 border-b md:border-b-0 md:border-r border-slate-700/50">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center space-x-2.5 p-2.5 rounded-md text-sm font-medium transition-colors
                                            ${activeTab === tab.id
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-300 hover:bg-slate-700/80 hover:text-slate-100'
                                            }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="flex flex-col flex-grow min-h-0">
                        <div className="md:hidden p-2 border-b border-slate-700/50 bg-slate-800">
                            <div className="flex space-x-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50 pb-1.5">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0
                                                    ${activeTab === tab.id
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'text-slate-300 hover:bg-slate-700/80 hover:text-slate-100'
                                                    }`}
                                    >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-grow p-4 sm:p-5 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50">
                            {ActiveTabComponent && (
                                <ActiveTabComponent
                                    // Passa props específicas para cada aba
                                    {...(activeTab === 'general' && { currentApiKey, setCurrentApiKey })}
                                    {...(activeTab === 'model' && { currentModelConfig: localModelConfig, onModelConfigChange: handleLocalModelConfigChange })}
                                    // As abas MemoriesSettingsTab e DataSettingsTab não precisam de props extras aqui,
                                    // pois usam seus próprios hooks de contexto.
                                />
                            )}
                        </div>
                        {/* Botão de Salvar Configurações no rodapé do modal */}
                        <div className="p-4 border-t border-slate-700/50 flex-shrink-0 bg-slate-800/70">
                            <Button
                                variant="primary"
                                onClick={handleSaveAllSettings}
                                className="w-full sm:w-auto !py-2.5"
                            >
                                Salvar Todas as Configurações
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;