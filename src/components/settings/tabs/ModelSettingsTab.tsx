import React from 'react';
import type { GeminiModelConfig, GeminiModel, SafetySetting } from '../../../types';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import RangeInput from '../../common/RangeInput';
import TextInput from '../../common/TextInput';
import Tooltip from '../../common/Tooltip'; // Import the new Tooltip component
import SettingsPanel from '../SettingsPanel'; // Import the new SettingsPanel
import { IoInformationCircleOutline } from 'react-icons/io5'; // Import info icon
import SelectInput from '../../common/SelectInput'; // Import the new SelectInput component

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
                        <SelectInput
                            id="model-select"
                            name="model"
                            label="Modelo Gemini"
                            tooltipContent="Escolha o modelo Gemini a ser utilizado."
                            value={currentGeminiModelConfig.model}
                            onChange={(value) => handleConfigChange('model', value as GeminiModel)}
                            options={AVAILABLE_GEMINI_MODELS.map(model => ({ value: model, label: model }))}
                        />
                    </div>

                    {/* Max Output Tokens */}
                    <div>
                        <TextInput
                            id="maxOutputTokens"
                            name="maxOutputTokens"
                            type="number"
                            label="Máximo de Tokens de Saída"
                            tooltipContent="Define o número máximo de tokens (palavras/partes de palavras) que a IA pode gerar em uma única resposta."
                            value={currentGeminiModelConfig.maxOutputTokens.toString()}
                            onChange={(value) => handleConfigChange('maxOutputTokens', parseInt(value, 10) || 1)}
                        />
                    </div>

                    {/* Temperature */}
                    <div>
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="Controla a aleatoriedade das respostas. Valores mais altos geram respostas mais criativas, mas potencialmente menos coerentes.">
                                <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                            </Tooltip>
                            <label htmlFor="temperature" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)]">
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
                                <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                            </Tooltip>
                            <label htmlFor="topP" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)]">
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
                                <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                            </Tooltip>
                            <label htmlFor="topK" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)]">
                                Top K
                            </label>
                            {/* Display value next to label */}
                            <span className="font-semibold text-[var(--color-model-settings-range-value-text)] ml-2">
                                : {currentGeminiModelConfig.topK}
                            </span>
                        </div>
                        <RangeInput
                            id="topK"
                            min={0}
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
                                <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                            </Tooltip>
                            <label htmlFor="thinkingBudget" className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)]">
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

                <section className="space-y-5">
                    <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)] pt-4 border-t border-[var(--color-settings-section-border)]">Configurações de Segurança</h2>
                    <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4">
                        Ajuste o nível de bloqueio para diferentes categorias de conteúdo potencialmente prejudicial.
                    </p>
                    
                    {HARM_CATEGORIES_CONFIG.map((harmCategory) => {
                        const currentThreshold = currentGeminiModelConfig.safetySettings?.find(
                            (s) => s.category === harmCategory.id
                        )?.threshold || HarmBlockThreshold.BLOCK_NONE;

                        return (
                            <div key={harmCategory.id}>
                                <SelectInput
                                    id={`safety-setting-${harmCategory.id}`}
                                    name={`safety-setting-${harmCategory.id}`}
                                    label={harmCategory.label}
                                    tooltipContent={`Define o nível de sensibilidade para bloquear conteúdo relacionado a "${harmCategory.label}".`}
                                    value={currentThreshold}
                                    onChange={(value) =>
                                        handleSafetySettingChange(
                                            harmCategory.id,
                                            value as HarmBlockThreshold
                                        )
                                    }
                                    options={HARM_BLOCK_THRESHOLDS.map(thresholdOption => ({
                                        value: thresholdOption.value,
                                        label: thresholdOption.label
                                    }))}
                                />
                            </div>
                        );
                    })}
                </section>
            </SettingsPanel>
        </div>
    );
};

export default ModelSettingsTab;
