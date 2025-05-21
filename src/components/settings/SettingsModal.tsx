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
    IoImageOutline as IoAvatarImageOutline,
    IoEarthOutline,
    IoAttachOutline,
    IoEyeOffOutline, // Icon for hide navigation
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
    SafetySetting,
    HarmCategory,
    HarmBlockThreshold,
} from "../../types";
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

const DEFAULT_PERSONALITY_FOR_PLACEHOLDER = `Você é uma IA professora / tutora de alunos que estão fazendo cursos na plataforma de ensino à distância Aulapp, e seu papel é ajudar os alunos a entenderem melhor o conteúdo do curso, responder perguntas e fornecer feedback sobre a evolução deles. Você deve ser amigável, paciente e encorajador, sempre buscando ajudar os alunos a aprenderem e se desenvolverem.`;

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
                    className={`block text-sm font-medium ${disabled ? "text-gray-400" : "text-gray-700"
                        }`}
                >
                    {label}
                </label>
                <span
                    className={`text-xs px-2 py-1 rounded-md ${disabled
                        ? "text-gray-500 bg-gray-100"
                        : "text-[#e04579] bg-pink-100"
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
                    ? "bg-gray-300 opacity-60 cursor-not-allowed"
                    : "bg-pink-100 accent-[#e04579] hover:opacity-90"
                    }`}
            />
            {info && (
                <p
                    className={`text-xs mt-1.5 ${disabled ? "text-gray-400" : "text-gray-500"
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
                        className="block text-sm font-medium text-gray-700 mb-1.5"
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
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-gray-800 shadow-sm transition-colors"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Sua chave de API é armazenada localmente no seu navegador e nunca é
                        enviada para nossos servidores.
                    </p>
                </div>
                <div>
                    <label
                        htmlFor="customPersonalityPrompt"
                        className="block text-sm font-medium text-gray-700 mb-1.5"
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
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-gray-800 shadow-sm transition-colors resize-y"
                    />
                    <p className="text-xs text-gray-500 mt-2">
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
    ) => void;
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
                    className="block text-sm font-medium text-gray-700 mb-1.5"
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
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579]/80 focus:border-[#e04579] text-gray-800 shadow-sm appearance-none bg-no-repeat bg-right pr-8"
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
                            className="bg-white text-gray-800"
                        >
                            {model}
                        </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
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
                    className="block text-sm font-medium text-gray-700 mb-1.5"
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
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579] focus:border-[#e04579] text-gray-800 shadow-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                    Limite de tokens na resposta da IA. (Ex: 8192 para Flash, até 32768
                    para Pro Preview)
                </p>
            </div>

            <div className="pt-3 mt-3 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                    <IoShieldCheckmarkOutline
                        size={18}
                        className="mr-2 text-[#e04579] opacity-90"
                    />
                    Configurações de Segurança de Conteúdo
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                    Define o quão estrito o modelo deve ser ao bloquear conteúdo
                    potencialmente prejudicial. "Bloquear Nenhum" é o mais permissivo.
                </p>
                <div className="space-y-3">
                    {activeSafetySettings.map((setting) => {
                        const categoryInfo = HARM_CATEGORIES_CONFIG.find(
                            (cat) => cat.id === setting.category
                        );
                        if (!categoryInfo) return null;

                        return (
                            <div key={setting.category}>
                                <label
                                    htmlFor={`safety-${setting.category}`}
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                    {categoryInfo.label}
                                </label>
                                <select
                                    id={`safety-${setting.category}`}
                                    name={`safety-${setting.category}`}
                                    value={setting.threshold}
                                    onChange={(e) => {
                                        handleSafetySettingChange(
                                            setting.category!,
                                            e.target.value as HarmBlockThreshold
                                        );
                                    }}
                                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579]/80 focus:border-[#e04579] text-gray-800 shadow-sm appearance-none bg-no-repeat bg-right pr-8 text-xs"
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
                                            className="bg-white text-gray-800"
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
                <h3 className="text-base font-semibold text-gray-800 w-full sm:w-auto">
                    Gerenciar Memórias ({memories.length})
                </h3>
                <div className="flex gap-2.5 flex-wrap">
                    <Button
                        variant="secondary"
                        className="!text-xs !py-2 !px-3.5 !font-medium"
                        onClick={handleExportMemories}
                        disabled={memories.length === 0}
                    >
                        {" "}
                        <IoDownloadOutline className="mr-1.5" /> Exportar{" "}
                    </Button>
                    <Button
                        variant="secondary"
                        className="!text-xs !py-2 !px-3.5 !font-medium"
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
                    className="flex-grow p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 transition-colors"
                />
                <Button
                    variant="primary"
                    onClick={handleAddNewMemory}
                    className="!py-2.5 !px-3 flex-shrink-0"
                    disabled={!newMemoryText.trim()}
                >
                    {" "}
                    <IoAddCircleOutline size={20} />{" "}
                </Button>
            </div>
            <div className="relative">
                <IoSearchOutline
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={18}
                />
                <input
                    type="text"
                    placeholder="Buscar memórias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-2.5 py-1.5 pl-10 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 transition-colors"
                />
            </div>
            {memories.length > 0 ? (
                filteredMemories.length > 0 ? (
                    <div className="overflow-y-auto space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-[calc(100vh-480px)] sm:max-h-[calc(100vh-450px)] min-h-[100px]">
                        {filteredMemories.map((memory) => (
                            <div
                                key={memory.id}
                                className="p-2.5 bg-white rounded-md shadow transition-shadow hover:shadow-md border border-gray-200"
                            >
                                {editingMemory?.id === memory.id ? (
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            value={editedMemoryText}
                                            onChange={(e) => setEditedMemoryText(e.target.value)}
                                            onKeyDown={handleEditMemoryKeyDown}
                                            ref={editMemoryInputRef}
                                            rows={3}
                                            className="w-full p-2 bg-white border border-gray-300 rounded text-xs text-gray-800 focus:border-[#e04579] focus:ring-1 focus:ring-[#e04579] resize-y min-h-[40px]"
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <Button
                                                variant="secondary"
                                                onClick={handleCancelMemoryEdit}
                                                className="!text-xs !py-1 !px-2.5"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={handleSaveMemoryEdit}
                                                className="!text-xs !py-1 !px-2.5"
                                            >
                                                Salvar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs text-gray-700 flex-grow break-words py-0.5 pr-1 whitespace-pre-wrap">
                                            {memory.content}
                                        </p>
                                        <div className="flex-shrink-0 flex items-center gap-1">
                                            <Button
                                                variant="icon"
                                                className="!p-1.5 text-gray-500 hover:!text-[#e04579] hover:!bg-pink-100"
                                                title="Editar memória"
                                                onClick={() => handleStartEditMemory(memory)}
                                            >
                                                {" "}
                                                <IoPencilOutline size={15} />{" "}
                                            </Button>
                                            <Button
                                                variant="icon"
                                                className="!p-1.5 text-gray-500 hover:!text-red-500 hover:!bg-red-100"
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
                    <div className="p-4 text-center bg-gray-50 rounded-lg border border-gray-200">
                        <IoSearchOutline
                            size={28}
                            className="mx-auto text-gray-400 mb-2"
                        />
                        <p className="text-sm text-gray-500">
                            Nenhuma memória encontrada para "{searchTerm}".
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Tente um termo de busca diferente ou limpe a busca.
                        </p>
                    </div>
                )
            ) : (
                <div className="p-4 text-center bg-gray-50 rounded-lg border border-gray-200">
                    <LuBrain size={28} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Nenhuma memória armazenada.</p>
                    <p className="text-xs text-gray-400 mt-1">
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
                <h3 className="text-base font-semibold text-gray-800">
                    Funções Externas (API Endpoints) ({currentFunctionDeclarations.length}
                    )
                </h3>
                {!isEditing && (
                    <Button
                        variant="primary"
                        onClick={handleStartAddNew}
                        className="!text-sm !py-2 !px-3.5"
                    >
                        <IoAddCircleOutline className="mr-1.5" size={18} /> Adicionar Nova
                    </Button>
                )}
            </div>
            <p className="text-xs text-gray-500 -mt-4">
                Declare APIs externas que a IA pode chamar. O Loox atuará como um proxy
                para essas chamadas.
            </p>
            {isEditing && (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md space-y-4">
                    <h4 className="text-sm font-semibold text-[#e04579]">{formTitle}</h4>
                    <div>
                        <label
                            htmlFor="funcName"
                            className="block text-xs font-medium text-gray-600 mb-1"
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
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Nome que a IA usará para chamar esta API. Use camelCase ou
                            snake_case.
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcDesc"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            Descrição (para a IA)
                        </label>
                        <textarea
                            id="funcDesc"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            placeholder="ex: Obtém o clima atual para uma localidade..."
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 resize-y"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Descreva o que a API faz...
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcEndpointUrl"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            URL do Endpoint da API
                        </label>
                        <input
                            type="url"
                            id="funcEndpointUrl"
                            value={editEndpointUrl}
                            onChange={(e) => setEditEndpointUrl(e.target.value)}
                            placeholder="ex: https://api.example.com/weather"
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="funcHttpMethod"
                            className="block text-xs font-medium text-gray-600 mb-1"
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
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] text-sm text-gray-800 appearance-none bg-no-repeat bg-right pr-8"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundSize: "1.5em 1.5em",
                                backgroundPosition: "right 0.5rem center",
                            }}
                        >
                            <option value="GET" className="bg-white">GET</option>
                            <option value="POST" className="bg-white">POST</option>
                            <option value="PUT" className="bg-white">PUT</option>
                            <option value="PATCH" className="bg-white">PATCH</option>
                            <option value="DELETE" className="bg-white">DELETE</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Para GET, os parâmetros da função serão adicionados como query
                            strings...
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcParams"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            Esquema de Parâmetros (JSON - para a IA)
                        </label>
                        <textarea
                            id="funcParams"
                            value={editParamsSchema}
                            onChange={(e) => setEditParamsSchema(e.target.value)}
                            rows={6}
                            placeholder={DEFAULT_FUNCTION_PARAMS_SCHEMA_PLACEHOLDER}
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 font-mono resize-y"
                        />
                        <p className="text-xs text-gray-500 mt-1">
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
                            className="!text-xs !py-1.5 !px-3"
                        >
                            Salvar Função
                        </Button>
                    </div>
                </div>
            )}
            {currentFunctionDeclarations.length > 0 ? (
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-[calc(100vh-480px)] sm:max-h-[calc(100vh-450px)] min-h-[100px]">
                    {currentFunctionDeclarations.map((declaration) => (
                        <div
                            key={declaration.id}
                            className={`p-2.5 bg-white rounded-md shadow border ${isEditing === declaration.id
                                ? "ring-2 ring-[#e04579] border-transparent"
                                : "border-gray-200 hover:shadow-md"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-grow">
                                    <p className="text-sm font-semibold text-[#e04579] break-words">
                                        {declaration.name}
                                    </p>
                                    <p
                                        className="text-xs text-gray-700 mt-0.5 break-words whitespace-pre-wrap"
                                        title={declaration.description}
                                    >
                                        {declaration.description.substring(0, 100)}
                                        {declaration.description.length > 100 ? "..." : ""}
                                    </p>
                                    <div className="mt-1.5 flex items-center text-xs text-gray-500">
                                        <IoLinkOutline size={14} className="mr-1 flex-shrink-0" />
                                        <span className="truncate" title={declaration.endpointUrl}>
                                            {declaration.endpointUrl}
                                        </span>
                                        <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] font-medium">
                                            {declaration.httpMethod}
                                        </span>
                                    </div>
                                </div>
                                {!isEditing && (
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                        <Button
                                            variant="icon"
                                            className="!p-1.5 text-gray-500 hover:!text-[#e04579] hover:!bg-pink-100"
                                            title="Editar função"
                                            onClick={() => handleStartEdit(declaration)}
                                        >
                                            {" "}
                                            <IoPencilOutline size={15} />{" "}
                                        </Button>
                                        <Button
                                            variant="icon"
                                            className="!p-1.5 text-gray-500 hover:!text-red-500 hover:!bg-red-100"
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
                    <div className="p-4 text-center bg-gray-50 rounded-lg border border-gray-200">
                        <IoTerminalOutline
                            size={28}
                            className="mx-auto text-gray-400 mb-2"
                        />
                        <p className="text-sm text-gray-500">
                            Nenhuma API externa configurada.
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Adicione APIs para que a IA possa interagir com serviços externos.
                        </p>
                    </div>
                )
            )}
        </div>
    );
};

const InterfaceSettingsTab: React.FC<{
    currentCodeHighlightEnabled: boolean;
    onToggleCodeHighlight: () => void;
    currentAiAvatarUrl: string;
    onAiAvatarUrlChange: (url: string) => void;
    currentEnableWebSearchEnabled: boolean;
    onToggleEnableWebSearch: () => void;
    currentAttachmentsEnabled: boolean;
    onToggleAttachmentsEnabled: () => void;
    currentHideNavigation: boolean; // New prop
    onToggleHideNavigation: () => void; // New prop
}> = ({
    currentCodeHighlightEnabled,
    onToggleCodeHighlight,
    currentAiAvatarUrl,
    onAiAvatarUrlChange,
    currentEnableWebSearchEnabled,
    onToggleEnableWebSearch,
    currentAttachmentsEnabled,
    onToggleAttachmentsEnabled,
    currentHideNavigation, // Destructure new prop
    onToggleHideNavigation, // Destructure new prop
}) => {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                    Configurações de Interface
                </h3>
                <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4 shadow">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Habilitar destaque de sintaxe para código
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Ativa o destaque de sintaxe para blocos de código.
                            </p>
                        </div>
                        <Switch
                            checked={currentCodeHighlightEnabled}
                            onChange={onToggleCodeHighlight}
                            className={`${currentCodeHighlightEnabled ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentCodeHighlightEnabled ? "translate-x-[20px]" : "translate-x-0"
                                    } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div>
                        <label
                            htmlFor="aiAvatarUrl"
                            className="block text-sm font-medium text-gray-700 mb-1.5"
                        >
                            URL da Imagem do Avatar da IA
                        </label>
                        <div className="flex items-center gap-2">
                            <IoAvatarImageOutline className="text-gray-500 flex-shrink-0" size={20} />
                            <input
                                type="url"
                                id="aiAvatarUrl"
                                name="aiAvatarUrl"
                                placeholder="https://exemplo.com/avatar.png (deixe em branco para padrão)"
                                value={currentAiAvatarUrl}
                                onChange={(e) => onAiAvatarUrlChange(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 shadow-sm transition-colors"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Forneça uma URL para uma imagem de avatar personalizada para a IA. Se
                            deixado em branco, o ícone padrão será usado.
                        </p>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Habilitar botão de busca na web
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Mostra/oculta o botão para ativar a busca na web para a próxima mensagem.
                            </p>
                        </div>
                        <Switch
                            checked={currentEnableWebSearchEnabled}
                            onChange={onToggleEnableWebSearch}
                            className={`${currentEnableWebSearchEnabled ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentEnableWebSearchEnabled ? "translate-x-[20px]" : "translate-x-0"
                                    } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Habilitar anexos de arquivos
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Mostra/oculta o botão para anexar arquivos às mensagens.
                            </p>
                        </div>
                        <Switch
                            checked={currentAttachmentsEnabled}
                            onChange={onToggleAttachmentsEnabled}
                            className={`${currentAttachmentsEnabled ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentAttachmentsEnabled ? "translate-x-[20px]" : "translate-x-0"
                                    } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Ocultar Navegação Principal
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Oculta a barra lateral de navegação e o botão de menu em dispositivos móveis.
                            </p>
                        </div>
                        <Switch
                            checked={currentHideNavigation}
                            onChange={onToggleHideNavigation}
                            className={`${currentHideNavigation ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentHideNavigation ? "translate-x-[20px]" : "translate-x-0"
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
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                    Gerenciamento de Dados
                </h3>
                <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4 shadow">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Apagar todas as memórias
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
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
                    <hr className="border-gray-200 my-3" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Apagar todas as conversas
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
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
                <p className="text-xs text-gray-500 mt-4 text-center">
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
    const [currentAiAvatarUrl, setCurrentAiAvatarUrl] = useState<string>("");
    const [isCodeHighlightEnabledState, setIsCodeHighlightEnabledState] =
        useState<boolean>(settings.codeSynthaxHighlightEnabled);
    const [currentEnableWebSearchEnabled, setCurrentEnableWebSearchEnabled] =
        useState<boolean>(settings.enableWebSearch);
    const [currentAttachmentsEnabled, setCurrentAttachmentsEnabled] =
        useState<boolean>(settings.enableAttachments);
    const [currentHideNavigation, setCurrentHideNavigation] = // New state for hide navigation
        useState<boolean>(settings.hideNavigation);


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
            setCurrentAiAvatarUrl(settings.aiAvatarUrl || "");
            setIsCodeHighlightEnabledState(settings.codeSynthaxHighlightEnabled);
            setCurrentEnableWebSearchEnabled(settings.enableWebSearch);
            setCurrentAttachmentsEnabled(settings.enableAttachments);
            setCurrentHideNavigation(settings.hideNavigation); // Load hideNavigation setting


            const currentSettingsSafety = settings.geminiModelConfig?.safetySettings;
            let effectiveSafetySettings: SafetySetting[];

            if (
                currentSettingsSafety &&
                Array.isArray(currentSettingsSafety) &&
                currentSettingsSafety.length === HARM_CATEGORIES_CONFIG.length
            ) {
                const allCategoriesPresent = HARM_CATEGORIES_CONFIG.every((hc) =>
                    currentSettingsSafety.find((s) => s.category === hc.id && s.threshold)
                );
                if (allCategoriesPresent) {
                    effectiveSafetySettings = currentSettingsSafety;
                } else {
                    effectiveSafetySettings = appDefaultSafetySettings;
                }
            } else {
                effectiveSafetySettings = appDefaultSafetySettings;
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

    const handleToggleCodeHighlightForTab = () => {
        if (!isCodeHighlightEnabledState) {
            if (
                window.confirm(
                    "Habilitar o destaque de sintaxe para código pode impactar o desempenho do aplicativo, especialmente em conversas muito longas com múltiplos blocos de código. Deseja continuar?"
                )
            ) {
                setIsCodeHighlightEnabledState(true);
            }
        } else {
            setIsCodeHighlightEnabledState(false);
        }
    };

    const handleToggleEnableWebSearchForTab = () => {
        setCurrentEnableWebSearchEnabled(prev => !prev);
    };

    const handleToggleAttachmentsEnabledForTab = () => {
        setCurrentAttachmentsEnabled(prev => !prev);
    };

    const handleToggleHideNavigationForTab = () => { // New handler for hide navigation toggle
        setCurrentHideNavigation(prev => !prev);
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

        const finalSafetySettings: SafetySetting[] = HARM_CATEGORIES_CONFIG.map(
            (hc) => {
                const foundSetting = localModelConfig.safetySettings?.find(
                    (s) => s.category === hc.id
                );
                return {
                    category: hc.id,
                    threshold:
                        foundSetting?.threshold || GenaiHarmBlockThresholdEnum.BLOCK_NONE,
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
            aiAvatarUrl: currentAiAvatarUrl.trim(),
            codeSynthaxHighlightEnabled: isCodeHighlightEnabledState,
            enableWebSearch: currentEnableWebSearchEnabled,
            enableAttachments: currentAttachmentsEnabled,
            hideNavigation: currentHideNavigation, // Save hideNavigation setting
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
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
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
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl text-gray-800 relative h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden border border-gray-200 text-left transform transition-all"
                            >
                                <div className="flex items-center justify-between p-4 pr-12 sm:p-5 sm:pr-14 border-b border-gray-200 flex-shrink-0 relative bg-white">
                                    <Dialog.Title
                                        as="h2"
                                        className="text-lg font-semibold text-gray-800"
                                    >
                                        Configurações do Aplicativo
                                    </Dialog.Title>
                                    <Button
                                        onClick={onClose}
                                        className="!absolute top-1/2 -translate-y-1/2 right-3 !p-2 text-gray-500 hover:text-gray-700 rounded-full hover:!bg-gray-100 z-10"
                                        variant="icon"
                                        aria-label="Fechar modal"
                                    >
                                        {" "}
                                        <IoClose size={24} />{" "}
                                    </Button>
                                </div>
                                <div className="flex flex-col md:flex-row flex-grow min-h-0">
                                    <nav className="w-full md:w-52 flex-shrink-0 flex md:flex-col bg-gray-50 p-2 md:p-3 space-x-1 md:space-x-0 md:space-y-1.5 border-b md:border-b-0 md:border-r border-gray-200 overflow-x-auto md:overflow-x-hidden">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => handleTabChange(tab.id)}
                                                className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group whitespace-nowrap flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e04579] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 ${activeTab === tab.id
                                                    ? "bg-[#e04579] text-white shadow-md scale-[1.02]"
                                                    : "text-gray-600 hover:bg-pink-50 hover:text-[#e04579] active:scale-[0.98]"
                                                    }`}
                                                style={{ flex: "0 0 auto" }}
                                            >
                                                {React.cloneElement(
                                                    tab.icon as React.ReactElement<any>,
                                                    {
                                                        className: `transition-transform duration-200 ${activeTab === tab.id
                                                            ? "text-white"
                                                            : "text-gray-400 group-hover:text-[#e04579]"
                                                            }`,
                                                    }
                                                )}
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </nav>
                                    <div className="flex flex-col flex-grow min-h-0 bg-gray-50 relative overflow-hidden">
                                        <div className="flex-grow p-4 sm:p-5 md:p-6 overflow-y-auto">
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
                                                                {...(tab.id === "interface" && {
                                                                    currentCodeHighlightEnabled: isCodeHighlightEnabledState,
                                                                    onToggleCodeHighlight: handleToggleCodeHighlightForTab,
                                                                    currentAiAvatarUrl: currentAiAvatarUrl,
                                                                    onAiAvatarUrlChange: setCurrentAiAvatarUrl,
                                                                    currentEnableWebSearchEnabled: currentEnableWebSearchEnabled,
                                                                    onToggleEnableWebSearch: handleToggleEnableWebSearchForTab,
                                                                    currentAttachmentsEnabled: currentAttachmentsEnabled,
                                                                    onToggleAttachmentsEnabled: handleToggleAttachmentsEnabledForTab,
                                                                    currentHideNavigation: currentHideNavigation, // Pass new state
                                                                    onToggleHideNavigation: handleToggleHideNavigationForTab, // Pass new handler
                                                                })}
                                                            />
                                                        </div>
                                                    </Transition>
                                                );
                                            })}
                                        </div>
                                        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-gray-50 flex justify-end">
                                            <Button
                                                variant="primary"
                                                onClick={handleSaveAllSettings}
                                                className="!py-2.5 !px-5 !font-semibold shadow-md hover:shadow-lg transform active:scale-[0.98] transition-all"
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
