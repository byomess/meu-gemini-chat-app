// src/components/settings/tabs/ModelSettingsTab.tsx
import React, { useMemo } from "react";
import type { GeminiModel, GeminiModelConfig, SafetySetting, HarmCategory, HarmBlockThreshold } from "../../../types";
import { HarmCategory as GenaiHarmCategoryEnum, HarmBlockThreshold as GenaiHarmBlockThresholdEnum } from "@google/genai";
import { IoShieldCheckmarkOutline } from "react-icons/io5";
import TextInput from "../../common/TextInput"; // Import TextInput

export const AVAILABLE_GEMINI_MODELS: GeminiModel[] = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash",
];

export const HARM_CATEGORIES_CONFIG: { id: HarmCategory; label: string }[] = [
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

export const HARM_BLOCK_THRESHOLDS_CONFIG: {
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

export const appDefaultSafetySettings: SafetySetting[] = [
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

interface ModelSettingsTabProps {
    currentModelConfig: GeminiModelConfig;
    onModelConfigChange: (
        field: keyof GeminiModelConfig | "safetySettings",
        value: unknown
    ) => void;
}

const ModelSettingsTab: React.FC<ModelSettingsTabProps> = ({ currentModelConfig, onModelConfigChange }) => {
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

    const maxTokensForModel = useMemo(() => {
        return currentModelConfig.model.includes("flash")
            ? 8192
            : currentModelConfig.model.includes("pro")
                ? currentModelConfig.model.includes("preview")
                    ? 32768
                    : 8192
                : 8192;
    }, [currentModelConfig.model]);

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
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579]/80 focus:border-[#e04579] text-gray-800 shadow-sm appearance-none bg-no-repeat bg-right pr-8"
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

            <TextInput
                id="maxOutputTokens"
                name="maxOutputTokens"
                label="Máximo de Tokens de Saída"
                type="number"
                value={String(currentModelConfig.maxOutputTokens)} // TextInput expects string value
                onChange={(value) => {
                    const numValue = parseInt(value, 10);
                    // Ensure the value is at least 1 and not NaN
                    onModelConfigChange("maxOutputTokens", isNaN(numValue) || numValue < 1 ? 1 : numValue);
                }}
                // Pass min, max, step directly; TextInput will pass them to the <input>
                // @ts-ignore because TextInputProps doesn't explicitly define these, but they are passed down
                min="1"
                // @ts-ignore
                max={String(maxTokensForModel)}
                // @ts-ignore
                step="1024"
                helperText={`Limite de tokens na resposta da IA. (Ex: 8192 para Flash, até ${maxTokensForModel} para ${currentModelConfig.model})`}
                // TextInput's baseInputClasses should handle most styling.
                // inputClassName="p-3" // Default TextInput padding is p-3
            />

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

export default ModelSettingsTab;
