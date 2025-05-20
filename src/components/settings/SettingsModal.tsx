// src/components/settings/SettingsModal.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { Dialog, Switch, Transition } from "@headlessui/react";
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
    IoSearchOutline,
    IoTerminalOutline,
    IoLinkOutline,
    IoShieldCheckmarkOutline,
    IoColorPaletteOutline,
} from "react-icons/io5";
import Button from "../common/Button";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { useMemories } from "../../contexts/MemoryContext";
import { useConversations } from "../../contexts/ConversationContext";
import type {
    Memory,
    GeminiModel,
    GeminiModelConfig,
    FunctionDeclaration as AppFunctionDeclaration,
    // Importando os tipos reexportados de src/types
    SafetySetting,
    HarmCategory,
    HarmBlockThreshold,
} from "../../types";
// Importando os ENUMS/VALORES do SDK para usar nas constantes
import {
    HarmCategory as GenaiHarmCategoryEnum,
    HarmBlockThreshold as GenaiHarmBlockThresholdEnum,
} from "@google/genai";
import { LuBrain } from "react-icons/lu";
import { FiDatabase } from "react-icons/fi";
import { v4 as uuidv4 } from "uuid";

interface LocalFunctionDeclaration {
    id: string;
    name: string;
    description: string;
    parametersSchema: string;
    endpointUrl: string;
    httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

const AVAILABLE_GEMINI_MODELS: GeminiModel[] = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash",
];

const DEFAULT_PERSONALITY_FOR_PLACEHOLDER = `Você é Loox, um assistente de IA pessoal projetado para ser um parceiro inteligente, prestativo e adaptável, operando dentro deste Web App. Sua missão é auxiliar os usuários em diversas tarefas, produtividade, explorar ideias e manter uma interação engajadora e personalizada.`;

const DEFAULT_FUNCTION_PARAMS_SCHEMA_PLACEHOLDER = `{
  "type": "object",
  "properties": {
    "paramName": {
      "type": "string",
      "description": "Description of the parameter."
    }
  },
  "required": ["paramName"]
}`;

// Constantes para Safety Settings usando os valores do SDK
const HARM_CATEGORIES_CONFIG: { id: HarmCategory; label: string }[] = [
    { id: GenaiHarmCategoryEnum.HARM_CATEGORY_HARASSMENT, label: "Assédio" },
    {
        id: GenaiHarmCategoryEnum.HARM_CATEGORY_HATE_SPEECH,
        label: "Discurso de Ódio",
    },
    {
        id: GenaiHarmCategoryEnum.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        label: "Conteúdo Sexualmente Explícito",
    },
    {
        id: GenaiHarmCategoryEnum.HARM_CATEGORY_DANGEROUS_CONTENT,
        label: "Conteúdo Perigoso",
    },
];

const HARM_BLOCK_THRESHOLDS_CONFIG: {
    id: HarmBlockThreshold;
    label: string;
}[] = [
        {
            id: GenaiHarmBlockThresholdEnum.BLOCK_NONE,
            label: "Bloquear Nenhum (Permitir Tudo)",
        },
        {
            id: GenaiHarmBlockThresholdEnum.BLOCK_ONLY_HIGH,
            label: "Bloquear Apenas Alto Risco",
        },
        {
            id: GenaiHarmBlockThresholdEnum.BLOCK_MEDIUM_AND_ABOVE,
            label: "Bloquear Médio Risco e Acima",
        },
        {
            id: GenaiHarmBlockThresholdEnum.BLOCK_LOW_AND_ABOVE,
            label: "Bloquear Baixo Risco e Acima",
        },
        // { id: GenaiHarmBlockThresholdEnum.HARM_BLOCK_THRESHOLD_UNSPECIFIED, label: "Padrão do Modelo" } // Se quiser esta opção
    ];

const appDefaultSafetySettings: SafetySetting[] = [
    {
        category: GenaiHarmCategoryEnum.HARM_CATEGORY_HARASSMENT,
        threshold: GenaiHarmBlockThresholdEnum.BLOCK_NONE,
    },
    {
        category: GenaiHarmCategoryEnum.HARM_CATEGORY_HATE_SPEECH,
        threshold: GenaiHarmBlockThresholdEnum.BLOCK_NONE,
    },
    {
        category: GenaiHarmCategoryEnum.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: GenaiHarmBlockThresholdEnum.BLOCK_NONE,
    },
    {
        category: GenaiHarmCategoryEnum.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: GenaiHarmBlockThresholdEnum.BLOCK_NONE,
    },
];

type TabId = "general" | "model" | "memories" | "functionCalling" | "interface" | "data";

interface Tab {
    id: TabId;
    label: string;
    icon: React.ReactElement;
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
}> = ({
    id,
    label,
    min,
    max,
    step,
    value,
    onChange,
    info,
    disabled = false,
}) => (
        <div className="mb-5 last:mb-0">
            <div className="flex justify-between items-center mb-1.5">
                <label
                    htmlFor={id}
                    className={`block text-sm font-medium ${disabled ? "text-slate-500" : "text-slate-200"
                        }`}
                >
                    {label}
                </label>
                <span
                    className={`text-xs px-2 py-1 rounded-md ${disabled
                        ? "text-slate-600 bg-slate-800/70"
                        : "text-sky-200 bg-sky-700/50"
                        }`}
                >
                    {value.toFixed(id === "temperature" || id === "topP" ? 2 : 0)}
                </span>
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
                className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer transition-opacity ${disabled
                    ? "bg-slate-700/70 opacity-60 cursor-not-allowed"
                    : "bg-slate-600/80 accent-sky-500 hover:opacity-90"
                    }`}
            />
            {info && (
                <p
                    className={`text-xs mt-1.5 ${disabled ? "text-slate-600" : "text-slate-400/90"
                        }`}
                >
                    {info}
                </p>
            )}
        </div>
    );

const GeneralSettingsTab: React.FC<{
    currentApiKey: string;
    setCurrentApiKey: (key: string) => void;
    currentCustomPersonalityPrompt: string;
    setCurrentCustomPersonalityPrompt: (prompt: string) => void;
}> = ({
    currentApiKey,
    setCurrentApiKey,
    currentCustomPersonalityPrompt,
    setCurrentCustomPersonalityPrompt,
}) => {
        return (
            <div className="space-y-6">
                <div>
                    <label
                        htmlFor="apiKey"
                        className="block text-sm font-medium text-slate-200 mb-1.5"
                    >
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
                        Sua chave de API é armazenada localmente no seu navegador e nunca é
                        enviada para nossos servidores.
                    </p>
                </div>
                <div>
                    <label
                        htmlFor="customPersonalityPrompt"
                        className="block text-sm font-medium text-slate-200 mb-1.5"
                    >
                        Papel / Personalidade da IA (Prompt de Sistema)
                    </label>
                    <textarea
                        id="customPersonalityPrompt"
                        name="customPersonalityPrompt"
                        rows={5}
                        placeholder={`Padrão: "${DEFAULT_PERSONALITY_FOR_PLACEHOLDER.substring(
                            0,
                            100
                        )}..." (Deixe em branco para usar o padrão).`}
                        value={currentCustomPersonalityPrompt}
                        onChange={(e) => setCurrentCustomPersonalityPrompt(e.target.value)}
                        className="w-full p-3 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-500 text-slate-100 shadow-sm transition-colors resize-y scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50"
                    />
                    <p className="text-xs text-slate-400/90 mt-2">
                        Define a persona base da IA. Isso será incluído no início da mensagem
                        de sistema. Se deixado em branco, um prompt padrão será usado.
                    </p>
                </div>
            </div>
        );
    };

const ModelSettingsTab: React.FC<{
    currentModelConfig: GeminiModelConfig;
    onModelConfigChange: (
        field: keyof GeminiModelConfig | "safetySettings",
        value: unknown
    ) => void; // Removido 'category' de onModelConfigChange
}> = ({ currentModelConfig, onModelConfigChange }) => {
    const handleSafetySettingChange = (
        categoryToUpdate: HarmCategory,
        newThreshold: HarmBlockThreshold
    ) => {
        const currentSettings =
            currentModelConfig.safetySettings || appDefaultSafetySettings;
        const updatedSafetySettings = currentSettings.map((setting) =>
            setting.category === categoryToUpdate
                ? { ...setting, threshold: newThreshold }
                : setting
        );
        onModelConfigChange("safetySettings", updatedSafetySettings);
    };

    const activeSafetySettings = useMemo(() => {
        const providedSettings = currentModelConfig.safetySettings || [];
        return HARM_CATEGORIES_CONFIG.map((configCat) => {
            const foundSetting = providedSettings.find(
                (s) => s.category === configCat.id
            );
            return (
                foundSetting || {
                    category: configCat.id,
                    threshold: GenaiHarmBlockThresholdEnum.BLOCK_NONE,
                }
            );
        });
    }, [currentModelConfig.safetySettings]);

    return (
        <div className="space-y-5 pb-5">
            <div>
                <label
                    htmlFor="modelName"
                    className="block text-sm font-medium text-slate-200 mb-1.5"
                >
                    Modelo Gemini
                </label>
                <select
                    id="modelName"
                    name="modelName"
                    value={currentModelConfig.model}
                    onChange={(e) =>
                        onModelConfigChange("model", e.target.value as GeminiModel)
                    }
                    className="w-full p-3 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-2 focus:ring-sky-500/80 focus:border-sky-500 text-slate-100 shadow-sm appearance-none bg-no-repeat bg-right pr-8"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundSize: "1.5em 1.5em",
                        backgroundPosition: "right 0.5rem center",
                    }}
                >
                    {AVAILABLE_GEMINI_MODELS.map((model) => (
                        <option
                            key={model}
                            value={model}
                            className="bg-slate-800 text-slate-100"
                        >
                            {model}
                        </option>
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
                onChange={(value) => onModelConfigChange("temperature", value)}
                info="Controla a aleatoriedade. Mais alto = mais criativo/aleatório."
            />
            <RangeInput
                id="topP"
                label="Top P"
                min={0.0}
                max={1.0}
                step={0.01}
                value={currentModelConfig.topP}
                onChange={(value) => onModelConfigChange("topP", value)}
                info="Considera tokens com probabilidade cumulativa até este valor."
            />
            <RangeInput
                id="topK"
                label="Top K"
                min={0}
                max={120}
                step={1}
                value={currentModelConfig.topK}
                onChange={(value) => onModelConfigChange("topK", value)}
                info="Considera os K tokens mais prováveis. (0 desativa)"
            />

            <div>
                <label
                    htmlFor="maxOutputTokens"
                    className="block text-sm font-medium text-slate-200 mb-1.5"
                >
                    Máximo de Tokens de Saída
                </label>
                <input
                    type="number"
                    id="maxOutputTokens"
                    name="maxOutputTokens"
                    min="1"
                    max={
                        currentModelConfig.model.includes("flash")
                            ? 8192
                            : currentModelConfig.model.includes("pro")
                                ? currentModelConfig.model.includes("preview")
                                    ? 32768
                                    : 8192
                                : 8192
                    }
                    step="1024"
                    value={currentModelConfig.maxOutputTokens}
                    onChange={(e) =>
                        onModelConfigChange(
                            "maxOutputTokens",
                            parseInt(e.target.value, 10) || 1
                        )
                    }
                    className="w-full p-3 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-100 shadow-sm"
                />
                <p className="text-xs text-slate-400/90 mt-2">
                    Limite de tokens na resposta da IA. (Ex: 8192 para Flash, até 32768
                    para Pro Preview)
                </p>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-700/60">
                <h4 className="text-sm font-semibold text-slate-100 mb-3 flex items-center">
                    <IoShieldCheckmarkOutline
                        size={18}
                        className="mr-2 text-sky-400 opacity-90"
                    />
                    Configurações de Segurança de Conteúdo
                </h4>
                <p className="text-xs text-slate-400/90 mb-4">
                    Define o quão estrito o modelo deve ser ao bloquear conteúdo
                    potencialmente prejudicial. "Bloquear Nenhum" é o mais permissivo.
                </p>
                <div className="space-y-3">
                    {activeSafetySettings.map((setting) => {
                        // `setting.category` aqui deve ser sempre definido por causa da lógica em `activeSafetySettings`
                        const categoryInfo = HARM_CATEGORIES_CONFIG.find(
                            (cat) => cat.id === setting.category
                        );
                        if (!categoryInfo) return null;

                        return (
                            <div key={setting.category}>
                                <label
                                    htmlFor={`safety-${setting.category}`}
                                    className="block text-sm font-medium text-slate-200 mb-1"
                                >
                                    {categoryInfo.label}
                                </label>
                                <select
                                    id={`safety-${setting.category}`}
                                    name={`safety-${setting.category}`}
                                    value={setting.threshold}
                                    onChange={(e) => {
                                        // setting.category aqui é garantido que não é undefined.
                                        handleSafetySettingChange(
                                            setting.category!,
                                            e.target.value as HarmBlockThreshold
                                        );
                                    }}
                                    className="w-full p-2.5 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-2 focus:ring-sky-500/80 focus:border-sky-500 text-slate-100 shadow-sm appearance-none bg-no-repeat bg-right pr-8 text-xs"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundSize: "1.5em 1.5em",
                                        backgroundPosition: "right 0.5rem center",
                                    }}
                                >
                                    {HARM_BLOCK_THRESHOLDS_CONFIG.map((thresholdConfig) => (
                                        <option
                                            key={thresholdConfig.id}
                                            value={thresholdConfig.id}
                                            className="bg-slate-800 text-slate-100"
                                        >
                                            {thresholdConfig.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const MemoriesSettingsTab: React.FC = () => {
    const {
        memories,
        addMemory,
        deleteMemory,
        updateMemory,
        replaceAllMemories,
    } = useMemories();
    const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
    const [editedMemoryText, setEditedMemoryText] = useState<string>("");
    const [newMemoryText, setNewMemoryText] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
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
        if (window.confirm("Tem certeza de que deseja apagar esta memória?")) {
            deleteMemory(id);
            if (editingMemory?.id === id) {
                setEditingMemory(null);
                setEditedMemoryText("");
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
            setEditedMemoryText("");
        } else if (editingMemory && !editedMemoryText.trim()) {
            alert("O conteúdo da memória não pode ser vazio.");
        }
    };
    const handleCancelMemoryEdit = () => {
        setEditingMemory(null);
        setEditedMemoryText("");
    };
    const handleAddNewMemory = () => {
        if (newMemoryText.trim()) {
            addMemory(newMemoryText.trim());
            setNewMemoryText("");
            if (newMemoryInputRef.current) {
                newMemoryInputRef.current.focus();
            }
        }
    };
    const handleNewMemoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddNewMemory();
        }
    };
    const handleEditMemoryKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSaveMemoryEdit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancelMemoryEdit();
        }
    };
    const handleExportMemories = () => {
        if (memories.length === 0) {
            alert("Nenhuma memória para exportar.");
            return;
        }
        const jsonString = JSON.stringify(memories, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `loox_chat_memories_${new Date().toISOString().split("T")[0]
            }.json`;
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
                if (typeof content === "string") {
                    const importedMemories = JSON.parse(content) as Memory[];
                    if (
                        Array.isArray(importedMemories) &&
                        importedMemories.every(
                            (mem) =>
                                typeof mem.id === "string" &&
                                typeof mem.content === "string" &&
                                typeof mem.timestamp === "string"
                        )
                    ) {
                        if (
                            window.confirm(
                                `Isso substituirá ${memories.length > 0
                                    ? "TODAS as memórias atuais"
                                    : "suas memórias (atualmente vazias)"
                                } por ${importedMemories.length
                                } memórias do arquivo. Deseja continuar?`
                            )
                        ) {
                            replaceAllMemories(
                                importedMemories.map((mem) => ({
                                    ...mem,
                                    timestamp: new Date(mem.timestamp),
                                }))
                            );
                        }
                    } else {
                        throw new Error(
                            "O arquivo JSON não contém um array de memórias válidas (cada memória deve ter 'id', 'content', 'timestamp')."
                        );
                    }
                }
            } catch (error) {
                console.error("Erro ao importar memórias:", error);
                alert(
                    `Erro ao importar memórias: ${error instanceof Error
                        ? error.message
                        : "Formato de arquivo inválido."
                    }`
                );
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };
    const filteredMemories = useMemo(() => {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        return memories
            .filter((memory) =>
                memory.content.toLowerCase().includes(lowercasedSearchTerm)
            )
            .slice()
            .reverse();
    }, [memories, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3 mb-1">
                <h3 className="text-base font-semibold text-slate-100 w-full sm:w-auto">
                    Gerenciar Memórias ({memories.length})
                </h3>
                <div className="flex gap-2.5 flex-wrap">
                    <Button
                        variant="secondary"
                        className="!text-xs !py-2 !px-3.5 !font-medium !bg-slate-600/70 hover:!bg-slate-600"
                        onClick={handleExportMemories}
                        disabled={memories.length === 0}
                    >
                        {" "}
                        <IoDownloadOutline className="mr-1.5" /> Exportar{" "}
                    </Button>
                    <Button
                        variant="secondary"
                        className="!text-xs !py-2 !px-3.5 !font-medium !bg-slate-600/70 hover:!bg-slate-600"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {" "}
                        <IoCloudUploadOutline className="mr-1.5" /> Importar{" "}
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
            <div className="flex items-center gap-2.5 mt-2">
                <input
                    ref={newMemoryInputRef}
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    onKeyDown={handleNewMemoryKeyDown}
                    placeholder="Adicionar nova memória..."
                    className="flex-grow p-2.5 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500 placeholder-slate-400 text-sm text-slate-100 transition-colors"
                />
                <Button
                    variant="primary"
                    onClick={handleAddNewMemory}
                    className="!py-2.5 !px-3 !bg-teal-600 hover:!bg-teal-500 active:!bg-teal-700 text-white flex-shrink-0"
                    disabled={!newMemoryText.trim()}
                >
                    {" "}
                    <IoAddCircleOutline size={20} />{" "}
                </Button>
            </div>
            <div className="relative">
                <IoSearchOutline
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none"
                    size={18}
                />
                <input
                    type="text"
                    placeholder="Buscar memórias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-2.5 py-1.5 pl-10 bg-slate-700/60 border border-slate-600/70 rounded-lg focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-sm text-slate-100 transition-colors"
                />
            </div>
            {memories.length > 0 ? (
                filteredMemories.length > 0 ? (
                    <div className="overflow-y-auto space-y-2 p-3 bg-slate-900/60 rounded-lg scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800/50 border border-slate-700/60 max-h-[calc(100vh-480px)] sm:max-h-[calc(100vh-450px)] min-h-[100px]">
                        {filteredMemories.map((memory) => (
                            <div
                                key={memory.id}
                                className="p-2.5 bg-slate-700/80 rounded-md shadow transition-shadow hover:shadow-md"
                            >
                                {editingMemory?.id === memory.id ? (
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            value={editedMemoryText}
                                            onChange={(e) => setEditedMemoryText(e.target.value)}
                                            onKeyDown={handleEditMemoryKeyDown}
                                            ref={editMemoryInputRef}
                                            rows={3}
                                            className="w-full p-2 bg-slate-600/70 border border-slate-500/80 rounded text-xs text-slate-100 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-y min-h-[40px] scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-600/50"
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <Button
                                                variant="secondary"
                                                onClick={handleCancelMemoryEdit}
                                                className="!text-xs !py-1 !px-2.5 !bg-slate-500/80 hover:!bg-slate-500"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={handleSaveMemoryEdit}
                                                className="!text-xs !py-1 !px-2.5 !bg-sky-600 hover:!bg-sky-500"
                                            >
                                                Salvar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs text-slate-200 flex-grow break-words py-0.5 pr-1 whitespace-pre-wrap">
                                            {memory.content}
                                        </p>
                                        <div className="flex-shrink-0 flex items-center gap-1">
                                            <Button
                                                variant="icon"
                                                className="!p-1.5 text-slate-400 hover:!text-sky-400 hover:!bg-slate-600/60"
                                                title="Editar memória"
                                                onClick={() => handleStartEditMemory(memory)}
                                            >
                                                {" "}
                                                <IoPencilOutline size={15} />{" "}
                                            </Button>
                                            <Button
                                                variant="icon"
                                                className="!p-1.5 text-slate-400 hover:!text-red-400 hover:!bg-slate-600/60"
                                                title="Excluir memória"
                                                onClick={() => handleLocalDeleteMemory(memory.id)}
                                            >
                                                {" "}
                                                <IoTrashBinOutline size={15} />{" "}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 text-center bg-slate-900/60 rounded-lg border border-slate-700/60">
                        <IoSearchOutline
                            size={28}
                            className="mx-auto text-slate-500 mb-2"
                        />
                        <p className="text-sm text-slate-400">
                            Nenhuma memória encontrada para "{searchTerm}".
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Tente um termo de busca diferente ou limpe a busca.
                        </p>
                    </div>
                )
            ) : (
                <div className="p-4 text-center bg-slate-900/60 rounded-lg border border-slate-700/60">
                    <LuBrain size={28} className="mx-auto text-slate-500 mb-2" />
                    <p className="text-sm text-slate-400">Nenhuma memória armazenada.</p>
                    <p className="text-xs text-slate-500 mt-1">
                        Adicione memórias para personalizar suas interações.
                    </p>
                </div>
            )}
        </div>
    );
};

const FunctionCallingSettingsTab: React.FC<{
    currentFunctionDeclarations: LocalFunctionDeclaration[];
    setCurrentFunctionDeclarations: (
        declarations: LocalFunctionDeclaration[]
    ) => void;
}> = ({ currentFunctionDeclarations, setCurrentFunctionDeclarations }) => {
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editParamsSchema, setEditParamsSchema] = useState("");
    const [editEndpointUrl, setEditEndpointUrl] = useState("");
    const [editHttpMethod, setEditHttpMethod] =
        useState<LocalFunctionDeclaration["httpMethod"]>("GET");
    const nameInputRef = useRef<HTMLInputElement>(null);
    const isValidUrl = (urlString: string): boolean => {
        try {
            new URL(urlString);
            return true;
        } catch {
            return false;
        }
    };
    const resetForm = () => {
        setIsEditing(null);
        setEditName("");
        setEditDescription("");
        setEditParamsSchema("");
        setEditEndpointUrl("");
        setEditHttpMethod("GET");
    };
    const handleStartAddNew = () => {
        resetForm();
        setIsEditing("new");
        setEditParamsSchema(DEFAULT_FUNCTION_PARAMS_SCHEMA_PLACEHOLDER);
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };
    const handleStartEdit = (declaration: LocalFunctionDeclaration) => {
        setIsEditing(declaration.id);
        setEditName(declaration.name);
        setEditDescription(declaration.description);
        setEditParamsSchema(declaration.parametersSchema);
        setEditEndpointUrl(declaration.endpointUrl);
        setEditHttpMethod(declaration.httpMethod);
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };
    const handleDelete = (id: string) => {
        if (
            window.confirm(
                `Tem certeza que deseja excluir a função "${currentFunctionDeclarations.find((d) => d.id === id)?.name ||
                "esta função"
                }"?`
            )
        ) {
            setCurrentFunctionDeclarations(
                currentFunctionDeclarations.filter((d) => d.id !== id)
            );
            if (isEditing === id) {
                resetForm();
            }
        }
    };
    const handleSave = () => {
        if (!editName.trim()) {
            alert("O nome da função é obrigatório.");
            return;
        }
        if (!editDescription.trim()) {
            alert("A descrição da função é obrigatória.");
            return;
        }
        if (!editEndpointUrl.trim()) {
            alert("A URL do Endpoint da API é obrigatória.");
            return;
        }
        if (!isValidUrl(editEndpointUrl.trim())) {
            alert("A URL do Endpoint da API fornecida não é válida.");
            return;
        }
        try {
            if (editParamsSchema.trim()) {
                JSON.parse(editParamsSchema);
            }
        } catch {
            alert(
                "O esquema de parâmetros não é um JSON válido. Verifique a sintaxe."
            );
            return;
        }
        const declarationData: Omit<LocalFunctionDeclaration, "id"> = {
            name: editName.trim(),
            description: editDescription.trim(),
            parametersSchema: editParamsSchema.trim(),
            endpointUrl: editEndpointUrl.trim(),
            httpMethod: editHttpMethod,
        };
        if (isEditing === "new") {
            setCurrentFunctionDeclarations([
                ...currentFunctionDeclarations,
                { id: uuidv4(), ...declarationData },
            ]);
        } else if (isEditing) {
            setCurrentFunctionDeclarations(
                currentFunctionDeclarations.map((d) =>
                    d.id === isEditing ? { ...d, ...declarationData } : d
                )
            );
        }
        resetForm();
    };
    const formTitle =
        isEditing === "new"
            ? "Adicionar Nova Função (API Endpoint)"
            : isEditing
                ? "Editar Função (API Endpoint)"
                : "";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-slate-100">
                    Funções Externas (API Endpoints) ({currentFunctionDeclarations.length}
                    )
                </h3>
                {!isEditing && (
                    <Button
                        variant="primary"
                        onClick={handleStartAddNew}
                        className="!text-sm !py-2 !px-3.5 !bg-teal-600 hover:!bg-teal-500"
                    >
                        <IoAddCircleOutline className="mr-1.5" size={18} /> Adicionar Nova
                    </Button>
                )}
            </div>
            <p className="text-xs text-slate-400 -mt-4">
                Declare APIs externas que a IA pode chamar. O Loox atuará como um proxy
                para essas chamadas.
            </p>
            {isEditing && (
                <div className="p-4 bg-slate-700/60 rounded-lg border border-slate-600/70 shadow-md space-y-4">
                    <h4 className="text-sm font-semibold text-sky-300">{formTitle}</h4>
                    <div>
                        <label
                            htmlFor="funcName"
                            className="block text-xs font-medium text-slate-300 mb-1"
                        >
                            Nome da Função (para a IA)
                        </label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            id="funcName"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="ex: getCurrentWeather, searchProducts"
                            className="w-full p-2.5 bg-slate-600/80 border border-slate-500/70 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-sm text-slate-100"
                        />
                        <p className="text-xs text-slate-400/80 mt-1">
                            Nome que a IA usará para chamar esta API. Use camelCase ou
                            snake_case.
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcDesc"
                            className="block text-xs font-medium text-slate-300 mb-1"
                        >
                            Descrição (para a IA)
                        </label>
                        <textarea
                            id="funcDesc"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            placeholder="ex: Obtém o clima atual para uma localidade..."
                            className="w-full p-2.5 bg-slate-600/80 border border-slate-500/70 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-sm text-slate-100 resize-y scrollbar-thin scrollbar-thumb-slate-500"
                        />
                        <p className="text-xs text-slate-400/80 mt-1">
                            Descreva o que a API faz...
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcEndpointUrl"
                            className="block text-xs font-medium text-slate-300 mb-1"
                        >
                            URL do Endpoint da API
                        </label>
                        <input
                            type="url"
                            id="funcEndpointUrl"
                            value={editEndpointUrl}
                            onChange={(e) => setEditEndpointUrl(e.target.value)}
                            placeholder="ex: https://api.example.com/weather"
                            className="w-full p-2.5 bg-slate-600/80 border border-slate-500/70 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-sm text-slate-100"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="funcHttpMethod"
                            className="block text-xs font-medium text-slate-300 mb-1"
                        >
                            Método HTTP
                        </label>
                        <select
                            id="funcHttpMethod"
                            value={editHttpMethod}
                            onChange={(e) =>
                                setEditHttpMethod(
                                    e.target.value as LocalFunctionDeclaration["httpMethod"]
                                )
                            }
                            className="w-full p-2.5 bg-slate-600/80 border border-slate-500/70 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-sm text-slate-100 appearance-none bg-no-repeat bg-right pr-8"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundSize: "1.5em 1.5em",
                                backgroundPosition: "right 0.5rem center",
                            }}
                        >
                            <option value="GET" className="bg-slate-700">
                                GET
                            </option>
                            <option value="POST" className="bg-slate-700">
                                POST
                            </option>
                            <option value="PUT" className="bg-slate-700">
                                PUT
                            </option>
                            <option value="PATCH" className="bg-slate-700">
                                PATCH
                            </option>
                            <option value="DELETE" className="bg-slate-700">
                                DELETE
                            </option>
                        </select>
                        <p className="text-xs text-slate-400/80 mt-1">
                            Para GET, os parâmetros da função serão adicionados como query
                            strings...
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcParams"
                            className="block text-xs font-medium text-slate-300 mb-1"
                        >
                            Esquema de Parâmetros (JSON - para a IA)
                        </label>
                        <textarea
                            id="funcParams"
                            value={editParamsSchema}
                            onChange={(e) => setEditParamsSchema(e.target.value)}
                            rows={6}
                            placeholder={DEFAULT_FUNCTION_PARAMS_SCHEMA_PLACEHOLDER}
                            className="w-full p-2.5 bg-slate-600/80 border border-slate-500/70 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-sm text-slate-100 font-mono resize-y scrollbar-thin scrollbar-thumb-slate-500"
                        />
                        <p className="text-xs text-slate-400/80 mt-1">
                            Define os parâmetros que a IA pode enviar para esta API...
                        </p>
                    </div>
                    <div className="flex justify-end gap-2.5">
                        <Button
                            variant="secondary"
                            onClick={resetForm}
                            className="!text-xs !py-1.5 !px-3"
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            className="!text-xs !py-1.5 !px-3 !bg-sky-600 hover:!bg-sky-500"
                        >
                            Salvar Função
                        </Button>
                    </div>
                </div>
            )}
            {currentFunctionDeclarations.length > 0 ? (
                <div className="space-y-2 p-3 bg-slate-900/60 rounded-lg scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800/50 border border-slate-700/60 max-h-[calc(100vh-480px)] sm:max-h-[calc(100vh-450px)] min-h-[100px]">
                    {currentFunctionDeclarations.map((declaration) => (
                        <div
                            key={declaration.id}
                            className={`p-2.5 bg-slate-700/80 rounded-md shadow ${isEditing === declaration.id
                                ? "ring-2 ring-sky-500"
                                : "hover:shadow-md"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-grow">
                                    <p className="text-sm font-semibold text-sky-400 break-words">
                                        {declaration.name}
                                    </p>
                                    <p
                                        className="text-xs text-slate-300/90 mt-0.5 break-words whitespace-pre-wrap"
                                        title={declaration.description}
                                    >
                                        {declaration.description.substring(0, 100)}
                                        {declaration.description.length > 100 ? "..." : ""}
                                    </p>
                                    <div className="mt-1.5 flex items-center text-xs text-slate-400">
                                        <IoLinkOutline size={14} className="mr-1 flex-shrink-0" />
                                        <span className="truncate" title={declaration.endpointUrl}>
                                            {declaration.endpointUrl}
                                        </span>
                                        <span className="ml-2 px-1.5 py-0.5 bg-slate-600 text-slate-300 rounded text-[10px] font-medium">
                                            {declaration.httpMethod}
                                        </span>
                                    </div>
                                </div>
                                {!isEditing && (
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                        <Button
                                            variant="icon"
                                            className="!p-1.5 text-slate-400 hover:!text-sky-400 hover:!bg-slate-600/60"
                                            title="Editar função"
                                            onClick={() => handleStartEdit(declaration)}
                                        >
                                            {" "}
                                            <IoPencilOutline size={15} />{" "}
                                        </Button>
                                        <Button
                                            variant="icon"
                                            className="!p-1.5 text-slate-400 hover:!text-red-400 hover:!bg-slate-600/60"
                                            title="Excluir função"
                                            onClick={() => handleDelete(declaration.id)}
                                        >
                                            {" "}
                                            <IoTrashBinOutline size={15} />{" "}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                !isEditing && (
                    <div className="p-4 text-center bg-slate-900/60 rounded-lg border border-slate-700/60">
                        <IoTerminalOutline
                            size={28}
                            className="mx-auto text-slate-500 mb-2"
                        />
                        <p className="text-sm text-slate-400">
                            Nenhuma API externa configurada.
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Adicione APIs para que a IA possa interagir com serviços externos.
                        </p>
                    </div>
                )
            )}
        </div>
    );
};

const InterfaceSettingsTab: React.FC = () => {
    const { settings, setSettings } = useAppSettings();
    const [isCodeHighlightEnabled, setIsCodeHighlightEnabled] =
        useState<boolean>(settings.codeSynthaxHighlightEnabled);
    const handleToggleCodeHighlight = () => {
        if (!isCodeHighlightEnabled) {
            if (
                window.confirm(
                    "Habilitar o destaque de sintaxe para código pode impactar o desempenho do aplicativo, especialmente em conversas muito longas com múltiplos blocos de código. Deseja continuar?"
                )
            ) {
                setIsCodeHighlightEnabled(true);
                setSettings((prev) => ({
                    ...prev,
                    codeSynthaxHighlightEnabled: true,
                }));
            }
        } else {
            setIsCodeHighlightEnabled(false);
            setSettings((prev) => ({
                ...prev,
                codeSynthaxHighlightEnabled: false,
            }));
        }
    };
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-slate-100 mb-3">
                    Configurações de Interface
                </h3>
                <div className="p-4 bg-slate-700/60 rounded-lg border border-slate-600/70 space-y-4 shadow">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-slate-100">
                                Habilitar destaque de sintaxe para código
                            </p>
                            <p className="text-xs text-slate-400/90 mt-0.5">
                                Ativa o destaque de sintaxe para blocos de código.
                            </p>
                        </div>
                        <Switch
                            checked={isCodeHighlightEnabled}
                            onChange={handleToggleCodeHighlight}
                            className={`${
                                isCodeHighlightEnabled ? "bg-teal-500" : "bg-slate-600"
                            } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${
                                    isCodeHighlightEnabled ? "translate-x-[20px]" : "translate-x-0"
                                } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DataSettingsTab: React.FC = () => {
    const { clearAllMemories, memories } = useMemories();
    const { deleteAllConversations, conversations } = useConversations();
    const handleLocalClearAllMemories = () => {
        if (
            window.confirm(
                "Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita."
            )
        ) {
            clearAllMemories();
        }
    };
    const handleLocalDeleteAllConversations = () => {
        if (
            window.confirm(
                "Tem certeza de que deseja apagar TODAS as conversas? Esta ação não pode ser desfeita e apagará todo o seu histórico."
            )
        ) {
            deleteAllConversations();
        }
    };
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-slate-100 mb-3">
                    Gerenciamento de Dados
                </h3>
                <div className="p-4 bg-slate-700/60 rounded-lg border border-slate-600/70 space-y-4 shadow">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-slate-100">
                                Apagar todas as memórias
                            </p>
                            <p className="text-xs text-slate-400/90 mt-0.5">
                                Remove todas as memórias armazenadas pela IA.
                            </p>
                        </div>
                        <Button
                            variant="danger"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-auto"
                            onClick={handleLocalClearAllMemories}
                            disabled={memories.length === 0}
                        >
                            {" "}
                            <IoTrashOutline className="mr-1.5" /> Limpar Memórias{" "}
                        </Button>
                    </div>
                    <hr className="border-slate-600/80 my-3" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-slate-100">
                                Apagar todas as conversas
                            </p>
                            <p className="text-xs text-slate-400/90 mt-0.5">
                                Remove todo o seu histórico de conversas.
                            </p>
                        </div>
                        <Button
                            variant="danger"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-auto"
                            onClick={handleLocalDeleteAllConversations}
                            disabled={conversations.length === 0}
                        >
                            {" "}
                            <IoChatbubblesOutline className="mr-1.5" /> Limpar Conversas{" "}
                        </Button>
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
    const [currentApiKey, setCurrentApiKey] = useState<string>("");
    const [currentCustomPersonalityPrompt, setCurrentCustomPersonalityPrompt] =
        useState<string>(DEFAULT_PERSONALITY_FOR_PLACEHOLDER);
    const [currentFunctionDeclarations, setCurrentFunctionDeclarations] =
        useState<LocalFunctionDeclaration[]>([]);
    const [activeTab, setActiveTab] = useState<TabId>("general");
    const modalContentRef = useRef<HTMLDivElement>(null);
    const [previousTab, setPreviousTab] = useState<TabId | null>(null);

    const defaultModelConfigValues = useMemo((): GeminiModelConfig => {
        const defaultFirstModel =
            AVAILABLE_GEMINI_MODELS[0] || "gemini-2.5-flash-preview-04-17";
        return {
            model: defaultFirstModel,
            temperature: 0.9,
            topP: 0.95,
            topK: 0,
            maxOutputTokens: defaultFirstModel.includes("flash")
                ? 8192
                : defaultFirstModel.includes("pro")
                    ? defaultFirstModel.includes("preview")
                        ? 32768
                        : 8192
                    : 8192,
            safetySettings: appDefaultSafetySettings,
        };
    }, []);

    const [localModelConfig, setLocalModelConfig] = useState<GeminiModelConfig>(
        settings.geminiModelConfig || defaultModelConfigValues
    );

    useEffect(() => {
        if (isOpen) {
            setCurrentApiKey(settings.apiKey || "");

            const currentSettingsSafety = settings.geminiModelConfig?.safetySettings;
            let effectiveSafetySettings: SafetySetting[];

            if (
                currentSettingsSafety &&
                Array.isArray(currentSettingsSafety) &&
                currentSettingsSafety.length === HARM_CATEGORIES_CONFIG.length
            ) {
                // Verifica se todas as categorias necessárias estão presentes e têm thresholds válidos
                const allCategoriesPresent = HARM_CATEGORIES_CONFIG.every((hc) =>
                    currentSettingsSafety.find((s) => s.category === hc.id && s.threshold)
                );
                if (allCategoriesPresent) {
                    effectiveSafetySettings = currentSettingsSafety;
                } else {
                    effectiveSafetySettings = appDefaultSafetySettings; // Reseta se incompleto ou inválido
                }
            } else {
                effectiveSafetySettings = appDefaultSafetySettings; // Default se não existir ou formato incorreto
            }

            const mergedModelConfig = {
                ...defaultModelConfigValues,
                ...(settings.geminiModelConfig || {}),
                safetySettings: effectiveSafetySettings,
            };
            setLocalModelConfig(mergedModelConfig);

            setCurrentCustomPersonalityPrompt(settings.customPersonalityPrompt || "");
            const loadedFuncDeclarations = (settings.functionDeclarations || []).map(
                (fd) => ({
                    id: fd.id,
                    name: fd.name,
                    description: fd.description,
                    parametersSchema: fd.parametersSchema,
                    endpointUrl: fd.endpointUrl || "",
                    httpMethod: fd.httpMethod || "GET",
                })
            );
            setCurrentFunctionDeclarations(loadedFuncDeclarations);
        }
    }, [isOpen, settings, defaultModelConfigValues]);

    useEffect(() => {
        if (isOpen) {
            setPreviousTab(null);
            setActiveTab("general");
        }
    }, [isOpen]);
    const handleTabChange = (newTabId: TabId) => {
        setPreviousTab(activeTab);
        setActiveTab(newTabId);
    };

    const handleLocalModelConfigChange = (
        field: keyof GeminiModelConfig | "safetySettings",
        value: unknown
    ) => {
        if (field === "safetySettings") {
            setLocalModelConfig((prev) => ({
                ...prev,
                safetySettings: value as SafetySetting[],
            }));
        } else {
            setLocalModelConfig((prev) => ({
                ...prev,
                [field as keyof GeminiModelConfig]: value,
            }));
        }
    };

    const handleSaveAllSettings = () => {
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

        const appFuncDeclarations: AppFunctionDeclaration[] =
            currentFunctionDeclarations.map((lfd) => ({
                id: lfd.id,
                name: lfd.name,
                description: lfd.description,
                parametersSchema: lfd.parametersSchema,
                endpointUrl: lfd.endpointUrl,
                httpMethod: lfd.httpMethod,
            }));

        // Garante que safetySettings está completo e corretamente tipado antes de salvar
        const finalSafetySettings: SafetySetting[] = HARM_CATEGORIES_CONFIG.map(
            (hc) => {
                const foundSetting = localModelConfig.safetySettings?.find(
                    (s) => s.category === hc.id
                );
                return {
                    category: hc.id, // Garante que é o tipo HarmCategory do SDK
                    threshold:
                        foundSetting?.threshold || GenaiHarmBlockThresholdEnum.BLOCK_NONE, // Garante que é o tipo HarmBlockThreshold do SDK
                };
            }
        );

        const newGeminiConfig: GeminiModelConfig = {
            ...localModelConfig,
            safetySettings: finalSafetySettings,
        };

        setSettings((prevSettings) => ({
            ...prevSettings,
            apiKey: currentApiKey,
            geminiModelConfig: newGeminiConfig,
            customPersonalityPrompt: currentCustomPersonalityPrompt.trim(),
            functionDeclarations: appFuncDeclarations,
        }));
        alert("Configurações salvas com sucesso!");
    };

    const tabs: Tab[] = [
        {
            id: "general",
            label: "Geral",
            icon: <IoKeyOutline size={18} className="opacity-80" />,
            component: GeneralSettingsTab,
        },
        {
            id: "model",
            label: "Modelo IA",
            icon: <IoBuildOutline size={18} className="opacity-80" />,
            component: ModelSettingsTab,
        },
        {
            id: "memories",
            label: "Memórias",
            icon: <LuBrain size={18} className="opacity-80" />,
            component: MemoriesSettingsTab,
        },
        {
            id: "functionCalling",
            label: "Funções (API)",
            icon: <IoTerminalOutline size={18} className="opacity-80" />,
            component: FunctionCallingSettingsTab,
        },
        {
            id: "interface",
            label: "Interface",
            icon: <IoColorPaletteOutline size={18} className="opacity-80" />,
            component: InterfaceSettingsTab,
        },
        {
            id: "data",
            label: "Dados",
            icon: <FiDatabase size={17} className="opacity-80" />,
            component: DataSettingsTab,
        },
    ];

    const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const previousTabIndex = previousTab
        ? tabs.findIndex((tab) => tab.id === previousTab)
        : -1;
    const slideDirection =
        previousTabIndex === -1 || activeTabIndex === previousTabIndex
            ? 0
            : activeTabIndex > previousTabIndex
                ? 1
                : -1;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-[100]"
                onClose={onClose}
                initialFocus={modalContentRef}
            >
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
                                    <Dialog.Title
                                        as="h2"
                                        className="text-lg font-semibold text-slate-100"
                                    >
                                        Configurações do Aplicativo
                                    </Dialog.Title>
                                    <Button
                                        onClick={onClose}
                                        className="!absolute top-1/2 -translate-y-1/2 right-3 !p-2 text-slate-400 hover:text-slate-100 rounded-full hover:!bg-slate-700/80 z-10"
                                        variant="icon"
                                        aria-label="Fechar modal"
                                    >
                                        {" "}
                                        <IoClose size={24} />{" "}
                                    </Button>
                                </div>
                                <div className="flex flex-col md:flex-row flex-grow min-h-0">
                                    <nav className="w-full md:w-52 flex-shrink-0 flex md:flex-col bg-slate-800/30 md:bg-slate-850/50 p-2 md:p-3 space-x-1 md:space-x-0 md:space-y-1.5 border-b md:border-b-0 md:border-r border-slate-700/60 overflow-x-auto md:overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => handleTabChange(tab.id)}
                                                className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group whitespace-nowrap flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 ${activeTab === tab.id
                                                    ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md scale-[1.02]"
                                                    : "text-slate-300 hover:bg-slate-700/70 hover:text-slate-50 active:scale-[0.98]"
                                                    }`}
                                                style={{ flex: "0 0 auto" }}
                                            >
                                                {React.cloneElement(
                                                    tab.icon as React.ReactElement<any>,
                                                    {
                                                        className: `transition-transform duration-200 ${activeTab === tab.id
                                                            ? "text-white"
                                                            : "text-slate-400 group-hover:text-slate-200"
                                                            }`,
                                                    }
                                                )}
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </nav>
                                    <div className="flex flex-col flex-grow min-h-0 bg-slate-800/20 relative overflow-hidden">
                                        <div className="flex-grow p-4 sm:p-5 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600/80 scrollbar-track-slate-700/50 scrollbar-thumb-rounded-full">
                                            {tabs.map((tab) => {
                                                const TabComponent = tab.component;
                                                const isTabActive = activeTab === tab.id;
                                                let enterFromClass = "opacity-0";
                                                let leaveToClass = "opacity-0";
                                                if (slideDirection !== 0) {
                                                    enterFromClass +=
                                                        slideDirection > 0
                                                            ? " translate-x-20"
                                                            : " -translate-x-20";
                                                    leaveToClass +=
                                                        slideDirection > 0
                                                            ? " -translate-x-20"
                                                            : " translate-x-20";
                                                }
                                                return (
                                                    <Transition
                                                        key={tab.id}
                                                        show={isTabActive}
                                                        as={Fragment}
                                                        enter="transition-all ease-in-out duration-300 transform"
                                                        enterFrom={enterFromClass}
                                                        enterTo="opacity-100 translate-x-0"
                                                        leave="transition-all ease-in-out duration-300 transform absolute inset-0"
                                                        leaveFrom="opacity-100 translate-x-0"
                                                        leaveTo={leaveToClass}
                                                    >
                                                        <div
                                                            className={`w-full h-full ${isTabActive ? "" : "hidden"
                                                                }`}
                                                        >
                                                            <TabComponent
                                                                {...(tab.id === "general" && {
                                                                    currentApiKey,
                                                                    setCurrentApiKey,
                                                                    currentCustomPersonalityPrompt,
                                                                    setCurrentCustomPersonalityPrompt,
                                                                })}
                                                                {...(tab.id === "model" && {
                                                                    currentModelConfig: localModelConfig,
                                                                    onModelConfigChange:
                                                                        handleLocalModelConfigChange,
                                                                })}
                                                                {...(tab.id === "functionCalling" && {
                                                                    currentFunctionDeclarations,
                                                                    setCurrentFunctionDeclarations,
                                                                })}
                                                            />
                                                        </div>
                                                    </Transition>
                                                );
                                            })}
                                        </div>
                                        <div className="p-4 border-t border-slate-700/60 flex-shrink-0 bg-slate-800/50 flex justify-end">
                                            <Button
                                                variant="primary"
                                                onClick={handleSaveAllSettings}
                                                className="!py-2.5 !px-5 !font-semibold !bg-sky-600 hover:!bg-sky-500 active:!bg-sky-700 shadow-md hover:shadow-lg transform active:scale-[0.98] transition-all"
                                            >
                                                <IoCheckmarkOutline size={18} className="mr-1.5" />{" "}
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
