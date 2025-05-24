// src/components/settings/tabs/ModelSettingsTab.tsx
import React from 'react';
import type { GeminiModelConfig, GeminiModel, SafetySetting } from '../../../types';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import RangeInput from '../../common/RangeInput';
import TextInput from '../../common/TextInput';
import Tooltip from '../../common/Tooltip'; // Import the new Tooltip component
import SettingsPanel from '../SettingsPanel'; // Import the new SettingsPanel

export interface ModelSettingsTabProps {
    currentGeminiModelConfig: GeminiModelConfig;
    setCurrentGeminiModelConfig: React.Dispatch<React.SetStateAction<GeminiModelConfig>>;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModel[] = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.5-flash-preview-04-17",
];

export const HARM_CATEGORIES_CONFIG = [
    { id: HarmCategory.HARM_CATEGORY_HARASSMENT, label: "Assédio" },
    { id: HarmCategory.HARM_CATEGORY_HATE_SPEECH, label: "Discurso de Ódio" },
    { id: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, label: "Conteúdo Sexual Explícito" },
    { id: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, label: "Conteúdo Perigoso" },
];

export const HARM_BLOCK_THRESHOLDS = [
    { value: HarmBlockThreshold.BLOCK_NONE, label: "Não Bloquear" },
    { value: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE, label: "Bloquear Baixo e Acima" },
    { value: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, label: "Bloquear Médio e Acima" },
    { value: HarmBlockThreshold.BLOCK_ONLY_HIGH, label: "Bloquear Alto e Acima" },
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
        value: string | number | SafetySetting[]
    ) => {
        setCurrentGeminiModelConfig((prev: GeminiModelConfig) => {
            const updatedConfig = { ...prev, [field]: value } as GeminiModelConfig;
            return updatedConfig;
        });
    };

    const handleSafetySettingChange = (category: HarmCategory, newThreshold: HarmBlockThreshold) => {
        setCurrentGeminiModelConfig(prevConfig => {
            const updatedSafetySettings = prevConfig.safetySettings?.map(setting =>
                setting.category === category
                    ? { ...setting, threshold: newThreshold }
                    : setting
            ) || [];

            return {
                ...prevConfig,
                safetySettings: updatedSafetySettings,
            };
        });
    };

    return (
        <div className="space-y-6">
            <SettingsPanel
                title="Configurações do Modelo"
                description="Ajuste os parâmetros do modelo Gemini para controlar o comportamento da IA."
            >
                <section className="space-y-5">
                    {/* Model Selection */}
                    <div>
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="Escolha o modelo Gemini a ser utilizado.">
                                {/* Default info icon will be used */}
                            </Tooltip>
                            <label htmlFor="model-select" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] ml-2"> {/* Added ml-2 for spacing */}
                                Modelo Gemini
                            </label>
                        </div>
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
                    </div>

                    {/* Max Output Tokens */}
                    <div>
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="Define o número máximo de tokens (palavras/partes de palavras) que a IA pode gerar em uma única resposta.">
                                {/* Default info icon will be used */}
                            </Tooltip>
                            <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] ml-2"> {/* Added ml-2 for spacing */}
                                Máximo de Tokens de Saída
                            </label>
                        </div>
                        <TextInput
                            id="maxOutputTokens"
                            name="maxOutputTokens"
                            type="number"
                            value={currentGeminiModelConfig.maxOutputTokens.toString()}
                            onChange={(value) => handleConfigChange('maxOutputTokens', parseInt(value, 10) || 1)}
                        />
                    </div>

                    {/* Temperature */}
                    <div>
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="Controla a aleatoriedade das respostas. Valores mais altos geram respostas mais criativas, mas potencialmente menos coerentes.">
                                {/* Default info icon will be used */}
                            </Tooltip>
                            <label htmlFor="temperature" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] ml-2"> {/* Added ml-2 for spacing */}
                                Temperatura
                            </label>
                            {/* Display value next to label */}
                            <span className="font-semibold text-[var(--color-model-settings-range-value-text)] ml-2">
                                : {currentGeminiModelConfig.temperature}
                            </span>
                        </div>
                        <RangeInput
                            id="temperature"
                            min={0}
                            max={1}
                            step={0.01}
                            value={currentGeminiModelConfig.temperature}
                            onChange={(value) => handleConfigChange('temperature', value)}
                        />
                    </div>

                    {/* Top P */}
                    <div>
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="Controla a diversidade das respostas. Um valor mais baixo foca em tokens mais prováveis.">
                                {/* Default info icon will be used */}
                            </Tooltip>
                            <label htmlFor="topP" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] ml-2"> {/* Added ml-2 for spacing */}
                                Top P
                            </label>
                            {/* Display value next to label */}
                            <span className="font-semibold text-[var(--color-model-settings-range-value-text)] ml-2">
                                : {currentGeminiModelConfig.topP}
                            </span>
                        </div>
                        <RangeInput
                            id="topP"
                            min={0}
                            max={1}
                            step={0.01}
                            value={currentGeminiModelConfig.topP}
                            onChange={(value) => handleConfigChange('topP', value)}
                        />
                    </div>

                    {/* Top K */}
                    <div>
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="Controla o número de tokens a serem considerados em cada etapa da geração.">
                                {/* Default info icon will be used */}
                            </Tooltip>
                            <label htmlFor="topK" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] ml-2"> {/* Added ml-2 for spacing */}
                                Top K
                            </label>
                            {/* Display value next to label */}
                            <span className="font-semibold text-[var(--color-model-settings-range-value-text)] ml-2">
                                : {currentGeminiModelConfig.topK}
                            </span>
                        </div>
                        <RangeInput
                            id="topK"
                            min={0} {/* Changed from 1 to 0 */}
                            max={40}
                            step={1}
                            value={currentGeminiModelConfig.topK}
                            onChange={(value) => handleConfigChange('topK', value)}
                        />
                    </div>

                    {/* Thinking Budget */}
                    <div>
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="Define o número máximo de tokens que o modelo pode usar para 'pensar' antes de gerar a resposta. Valores mais altos podem levar a respostas mais complexas, mas consomem mais recursos.">
                                {/* Default info icon will be used */}
                            </Tooltip>
                            <label htmlFor="thinkingBudget" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] ml-2"> {/* Added ml-2 for spacing */}
                                Orçamento de Pensamento (Tokens)
                            </label>
                            {/* Display value next to label */}
                            <span className="font-semibold text-[var(--color-model-settings-range-value-text)] ml-2">
                                : {currentGeminiModelConfig.thinkingBudget ?? 0}
                            </span>
                        </div>
                        <RangeInput
                            id="thinkingBudget"
                            min={0}
                            max={4096}
                            step={128}
                            value={currentGeminiModelConfig.thinkingBudget ?? 0}
                            onChange={(value) => handleConfigChange('thinkingBudget', value)}
                        />
                    </div>
                </section>
            </SettingsPanel>

            <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)] pt-4 border-t border-[var(--color-settings-section-border)]">Configurações de Segurança</h2>
            <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4">
                Ajuste o nível de bloqueio para diferentes categorias de conteúdo potencialmente prejudicial.
            </p>

            <section className="space-y-5">
                {HARM_CATEGORIES_CONFIG.map((harmCategory) => {
                    const currentThreshold = currentGeminiModelConfig.safetySettings?.find(
                        (s) => s.category === harmCategory.id
                    )?.threshold || HarmBlockThreshold.BLOCK_NONE;

                    return (
                        <div key={harmCategory.id}>
                            <div className="flex items-center mb-1.5">
                                <Tooltip content={`Define o nível de sensibilidade para bloquear conteúdo relacionado a "${harmCategory.label}".`}>
                                    {/* Default info icon will be used */}
                                </Tooltip>
                                <label htmlFor={`safety-setting-${harmCategory.id}`} className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] ml-2"> {/* Added ml-2 for spacing */}
                                    {harmCategory.label}
                                </label>
                            </div>
                            <select
                                id={`safety-setting-${harmCategory.id}`}
                                value={currentThreshold}
                                onChange={(e) =>
                                    handleSafetySettingChange(
                                        harmCategory.id,
                                        e.target.value as HarmBlockThreshold
                                    )
                                }
                                className="w-full p-3 bg-[var(--color-settings-model-select-bg)] border border-[var(--color-settings-model-select-border)] rounded-lg text-[var(--color-settings-model-select-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-[var(--color-settings-model-select-focus-border)] transition-colors
                                    [&>option]:bg-[var(--color-settings-model-select-bg)] [&>option]:text-[var(--color-settings-model-select-text)] [&>option:hover]:bg-[var(--color-settings-model-select-option-hover-bg)]"
                            >
                                {HARM_BLOCK_THRESHOLDS.map((thresholdOption) => (
                                    <option key={thresholdOption.value} value={thresholdOption.value}>
                                        {thresholdOption.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </section>
        </div>
    );
};

export default ModelSettingsTab;
