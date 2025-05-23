// src/components/settings/tabs/GeneralSettingsTab.tsx
import React from 'react';
import TextInput from '../../common/TextInput';

interface GeneralSettingsTabProps {
    currentApiKey: string;
    setCurrentApiKey: (key: string) => void;
    currentCustomPersonalityPrompt: string;
    setCurrentCustomPersonalityPrompt: (prompt: string) => void;
}

const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
    currentApiKey,
    setCurrentApiKey,
    currentCustomPersonalityPrompt,
    setCurrentCustomPersonalityPrompt,
}) => {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)]">Configurações Gerais</h2>
            <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4 border-b border-[var(--color-settings-section-border)]">
                Gerencie sua chave de API e personalize a personalidade da IA.
            </p>

            <section className="space-y-4">
                <div>
                    <TextInput
                        id="api-key"
                        name="apiKey"
                        label="Google Gemini API Key"
                        value={currentApiKey}
                        onChange={setCurrentApiKey}
                        type="password"
                        placeholder="Insira sua API Key aqui..."
                        helperText={
                            <span>
                                Obtenha sua API Key em{' '}
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--color-link-text)] hover:text-[var(--color-link-hover-text)] underline"
                                >
                                    Google AI Studio
                                </a>
                                . Sua chave é armazenada localmente no seu navegador.
                            </span>
                        }
                        inputClassName="bg-[var(--color-general-settings-api-key-bg)] border-[var(--color-general-settings-api-key-border)] text-[var(--color-general-settings-api-key-text)] placeholder-[var(--color-general-settings-api-key-placeholder)] focus:border-[var(--color-general-settings-api-key-focus-border)]"
                    />
                </div>

                <div>
                    <TextInput
                        id="custom-personality-prompt"
                        name="customPersonalityPrompt"
                        label="Prompt de Personalidade Personalizado"
                        value={currentCustomPersonalityPrompt}
                        onChange={setCurrentCustomPersonalityPrompt}
                        type="text"
                        placeholder="Ex: Você é um assistente prestativo e amigável."
                        helperText="Defina um prompt para guiar a personalidade e o comportamento da IA. Deixe em branco para o padrão."
                        inputClassName="bg-[var(--color-general-settings-api-key-bg)] border-[var(--color-general-settings-api-key-border)] text-[var(--color-general-settings-api-key-text)] placeholder-[var(--color-general-settings-api-key-placeholder)] focus:border-[var(--color-general-settings-api-key-focus-border)]"
                    />
                </div>
            </section>
        </div>
    );
};

export default GeneralSettingsTab;
