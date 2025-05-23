// src/components/settings/tabs/ModelSettingsTab.tsx
import React from 'react';
import { GeminiModelConfig, GeminiModel } from '../../../types';

interface ModelSettingsTabProps {
    currentGeminiModelConfig: GeminiModelConfig;
    setCurrentGeminiModelConfig: (config: GeminiModelConfig) => void;
}

const ModelSettingsTab: React.FC<ModelSettingsTabProps> = ({
    currentGeminiModelConfig,
    setCurrentGeminiModelConfig,
}) => {
    const handleConfigChange = (field: keyof GeminiModelConfig, value: any) => {
        setCurrentGeminiModelConfig(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const renderRangeInput = (
        id: keyof GeminiModelConfig,
        label: string,
        min: number,
        max: number,
        step: number,
        value: number,
        helperText: string,
        disabled: boolean = false
    ) => (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] mb-1.5">
                {label}: <span className={`font-semibold ${disabled ? 'text-[var(--color-range-slider-value-text-disabled)]' : 'text-[var(--color-model-settings-range-value-text)]'}`}>{value}</span>
            </label>
            <input
                type="range"
                id={id}
                name={id}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => handleConfigChange(id, parseFloat(e.target.value))}
                disabled={disabled}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer
                    ${disabled ? 'bg-[var(--color-range-slider-track-bg-disabled)]' : 'bg-[var(--color-model-settings-range-input-bg)]'}
                    [&::-webkit-slider-runnable-track]:rounded-lg
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:mt-[-4px]
                    ${disabled
                        ? '[&::-webkit-slider-thumb]:bg-[var(--color-range-slider-thumb-bg-disabled)] [&::-webkit-slider-thumb]:border-[var(--color-range-slider-thumb-border-disabled)]'
                        : '[&::-webkit-slider-thumb]:bg-[var(--color-model-settings-range-input-thumb)] [&::-webkit-slider-thumb]:border-[var(--color-model-settings-range-input-thumb-border)]'
                    }
                    ${disabled
                        ? '[&::-webkit-slider-runnable-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-webkit-slider-runnable-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                `}
            />
            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">{helperText}</p>
        </div>
    );

    const availableModels: GeminiModel[] = [
        "gemini-2.5-pro-preview-05-06",
        "gemini-2.5-flash-preview-04-17",
    ];

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
                        {availableModels.map(model => (
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
                {renderRangeInput(
                    'temperature',
                    'Temperatura',
                    0, 1, 0.01,
                    currentGeminiModelConfig.temperature,
                    'Controla a aleatoriedade das respostas. Valores mais altos geram respostas mais criativas, mas potencialmente menos coerentes.'
                )}

                {/* Top P */}
                {renderRangeInput(
                    'topP',
                    'Top P',
                    0, 1, 0.01,
                    currentGeminiModelConfig.topP,
                    'Controla a diversidade das respostas. Um valor mais baixo foca em tokens mais prováveis.'
                )}

                {/* Top K */}
                {renderRangeInput(
                    'topK',
                    'Top K',
                    1, 40, 1,
                    currentGeminiModelConfig.topK,
                    'Controla o número de tokens a serem considerados em cada etapa da geração.'
                )}

                {/* Max Output Tokens */}
                {renderRangeInput(
                    'maxOutputTokens',
                    'Máximo de Tokens de Saída',
                    1, 2048, 1,
                    currentGeminiModelConfig.maxOutputTokens,
                    'Define o número máximo de tokens (palavras/partes de palavras) que a IA pode gerar em uma única resposta.'
                )}
            </section>
        </div>
    );
};

export default ModelSettingsTab;
