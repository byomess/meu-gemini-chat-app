// src/components/settings/tabs/ModelSettingsTab.tsx
import React from 'react';
import type { GeminiModelConfig, GeminiModel, SafetySetting } from '../../../types';
import { HarmCategory, HarmBlockThreshold } from '@google/genai'; // Import from @google/genai
import RangeInput from '../../common/RangeInput'; // Import the new RangeInput component

export interface ModelSettingsTabProps {
    currentGeminiModelConfig: GeminiModelConfig;
    setCurrentGeminiModelConfig: (config: GeminiModelConfig) => void;
}

// Define constants used in SettingsModal and this component
export const AVAILABLE_GEMINI_MODELS: GeminiModel[] = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
];

export const HARM_CATEGORIES_CONFIG = [
    { id: HarmCategory.HARM_CATEGORY_HARASSMENT, label: "Assédio" },
    { id: HarmCategory.HARM_CATEGORY_HATE_SPEECH, label: "Discurso de Ódio" },
    { id: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, label: "Conteúdo Sexual Explícito" },
    { id: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, label: "Conteúdo Perigoso" },
];

export const appDefaultSafetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];


const ModelSettingsTab: React.FC<ModelSettingsTabProps> = ({
    currentGeminiModelConfig,
    setCurrentGeminiModelConfig,
}) => {
    const handleConfigChange = (
        field: keyof GeminiModelConfig,
        value: string | number | SafetySetting[] // More specific type for value
    ) => {
        setCurrentGeminiModelConfig(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)]">Configurações do Modelo</h2>
            <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4 border-b border-[var(--color-settings-section-border)]">
                Ajuste os parâmetros do modelo Gemini para controlar o comportamento da IA.
            </p>

            <section className="space-y-5">
                {/* Model Selection */}
                <div>
                    <label htmlFor="model-select" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] mb-1.5">
                        Modelo Gemini
                    </label>
                    <select
                        id="model-select"
                        name="model"
                        value={currentGeminiModelConfig.model}
                        onChange={(e) => handleConfigChange('model', e.target.value as GeminiModel)}
                        className="w-full p-3 bg-[var(--color-settings-model-select-bg)] border border-[var(--color-settings-model-select-border)] rounded-lg text-[var(--color-settings-model-select-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-[var(--color-settings-model-select-focus-border)] transition-colors
                            [&>option]:bg-[var(--color-settings-model-select-bg)] [&>option]:text-[var(--color-settings-model-select-text)] [&>option:hover]:bg-[var(--color-settings-model-select-option-hover-bg)]"
                    >
                        {AVAILABLE_GEMINI_MODELS.map(model => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">
                        Escolha o modelo Gemini a ser utilizado.
                    </p>
                </div>

                {/* Temperature */}
                <RangeInput
                    id="temperature"
                    label="Temperatura"
                    min={0}
                    max={1}
                    step={0.01}
                    value={currentGeminiModelConfig.temperature}
                    onChange={(value) => handleConfigChange('temperature', value)}
                    helperText="Controla a aleatoriedade das respostas. Valores mais altos geram respostas mais criativas, mas potencialmente menos coerentes."
                />

                {/* Top P */}
                <RangeInput
                    id="topP"
                    label="Top P"
                    min={0}
                    max={1}
                    step={0.01}
                    value={currentGeminiModelConfig.topP}
                    onChange={(value) => handleConfigChange('topP', value)}
                    helperText="Controla a diversidade das respostas. Um valor mais baixo foca em tokens mais prováveis."
                />

                {/* Top K */}
                <RangeInput
                    id="topK"
                    label="Top K"
                    min={1}
                    max={40}
                    step={1}
                    value={currentGeminiModelConfig.topK}
                    onChange={(value) => handleConfigChange('topK', value)}
                    helperText="Controla o número de tokens a serem considerados em cada etapa da geração."
                />

                {/* Max Output Tokens */}
                <RangeInput
                    id="maxOutputTokens"
                    label="Máximo de Tokens de Saída"
                    min={1}
                    max={2048}
                    step={1}
                    value={currentGeminiModelConfig.maxOutputTokens}
                    onChange={(value) => handleConfigChange('maxOutputTokens', value)}
                    helperText="Define o número máximo de tokens (palavras/partes de palavras) que a IA pode gerar em uma única resposta."
                />
            </section>
        </div>
    );
};

export default ModelSettingsTab;
