import React from 'react';
import TextInput from '../../common/TextInput';
import TextAreaInput from '../../common/TextAreaInput'; // Import the new TextAreaInput
import { DEFAULT_PERSONALITY_PROMPT } from '../../../contexts/AppSettingsContext'; // Import the correct constant
import SettingsPanel from '../SettingsPanel'; // Import the new SettingsPanel

export interface GeneralSettingsTabProps {
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
            <SettingsPanel
                title="Configurações Gerais"
                description="Gerencie sua chave de API e personalize a personalidade da IA."
            >
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
                        <TextAreaInput // Changed from TextInput to TextAreaInput
                            id="custom-personality-prompt"
                            name="customPersonalityPrompt"
                            label="Prompt de Personalidade Personalizado"
                            value={currentCustomPersonalityPrompt}
                            onChange={setCurrentCustomPersonalityPrompt}
                            placeholder="Ex: Você é um assistente prestativo e amigável."
                            rows={6} // Added rows prop for textarea height
                            helperText={
                                <span>
                                    Defina um prompt para guiar a personalidade e o comportamento da IA. Deixe em branco para o padrão.
                                    <br />
                                    <span className="italic text-[var(--color-settings-section-description-text)]">
                                        Padrão: "{DEFAULT_PERSONALITY_PROMPT}"
                                    </span>
                                </span>
                            }
                            inputClassName="bg-[var(--color-general-settings-api-key-bg)] border-[var(--color-general-settings-api-key-border)] text-[var(--color-general-settings-api-key-text)] placeholder-[var(--color-general-settings-api-key-placeholder)] focus:border-[var(--color-general-settings-api-key-focus-border)]"
                        />
                    </div>
                </section>
            </SettingsPanel>
        </div>
    );
};

export default GeneralSettingsTab;
