// src/contexts/AppSettingsContext.tsx
import React, { createContext, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
// Importa os tipos do @google/genai diretamente ou via reexportação de src/types
import { HarmCategory, HarmBlockThreshold, type SafetySetting } from '../types';
import type { AppSettings, GeminiModelConfig, GeminiModel, FunctionDeclaration } from '../types';

const APP_SETTINGS_KEY = 'geminiChat_appSettings';
const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-2.5-pro-preview-05-06";

export const DEFAULT_PERSONALITY_PROMPT = `Você é Loox, um assistente de IA pessoal projetado para ser um parceiro inteligente, prestativo e adaptável, operando dentro deste Web App. Sua missão é auxiliar os usuários em diversas tarefas, produtividade, explorar ideias e manter uma interação engajadora e personalizada.`;

// Definição padrão para safetySettings usando os tipos importados
const defaultSafetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const defaultAppSettings: AppSettings = {
    apiKey: '',
    theme: 'dark',
    customPersonalityPrompt: DEFAULT_PERSONALITY_PROMPT,
    geminiModelConfig: {
        model: DEFAULT_GEMINI_MODEL,
        temperature: 0.90,
        topP: 0.95,
        topK: 0,
        maxOutputTokens: 32768,
        safetySettings: defaultSafetySettings,
    },
    functionDeclarations: [],
    codeSynthaxHighlightEnabled: false,
};

interface AppSettingsContextType {
    settings: AppSettings;
    setSettings: (settings: AppSettings | ((prevSettings: AppSettings) => AppSettings)) => void;
    saveApiKey: (apiKey: string) => void;
    updateGeminiModelConfig: (config: Partial<GeminiModelConfig>) => void;
    updateFunctionDeclarations: (declarations: FunctionDeclaration[]) => void;
    updateCodeSyntaxHighlightEnabled: (enabled: boolean) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useLocalStorage<AppSettings>(
        APP_SETTINGS_KEY,
        defaultAppSettings
    );

    React.useEffect(() => {
        if (settings && settings.geminiModelConfig) {
            let needsUpdate = false;
            let currentSafetySettings = settings.geminiModelConfig.safetySettings;

            if (!currentSafetySettings || currentSafetySettings.length !== defaultSafetySettings.length) {
                currentSafetySettings = defaultSafetySettings;
                needsUpdate = true;
            } else {
                // Verifica se todas as categorias default estão presentes
                for (const defaultSetting of defaultSafetySettings) {
                    if (!currentSafetySettings.find(s => s.category === defaultSetting.category)) {
                        currentSafetySettings = defaultSafetySettings; // Reseta se incompleto
                        needsUpdate = true;
                        break;
                    }
                }
            }

            if (needsUpdate) {
                setSettings(prevSettings => ({
                    ...prevSettings,
                    geminiModelConfig: {
                        ...prevSettings.geminiModelConfig,
                        safetySettings: currentSafetySettings,
                    },
                }));
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.geminiModelConfig?.safetySettings]); // Dependência mais específica

    const saveApiKey = (apiKey: string) => {
        setSettings((prevSettings) => ({ ...prevSettings, apiKey }));
    };

    const updateGeminiModelConfig = (configUpdate: Partial<GeminiModelConfig>) => {
        setSettings((prevSettings) => {
            const newModelConfig = {
                ...prevSettings.geminiModelConfig,
                ...configUpdate,
            };
            // Assegura que safetySettings seja sempre um array válido
            if (!newModelConfig.safetySettings || !Array.isArray(newModelConfig.safetySettings)) {
                newModelConfig.safetySettings = defaultSafetySettings;
            }
            return {
                ...prevSettings,
                geminiModelConfig: newModelConfig,
            };
        });
    };

    const updateFunctionDeclarations = (declarations: FunctionDeclaration[]) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            functionDeclarations: declarations,
        }));
    };

    const updateCodeSyntaxHighlightEnabled = (enabled: boolean) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            sythaxHighlightEnabled: enabled,
        }));
    };

    return (
        <AppSettingsContext.Provider value={{
            settings,
            setSettings,
            saveApiKey,
            updateGeminiModelConfig,
            updateFunctionDeclarations,
            updateCodeSyntaxHighlightEnabled
        }}>
            {children}
        </AppSettingsContext.Provider>
    );
};

export const useAppSettings = (): AppSettingsContextType => {
    const context = useContext(AppSettingsContext);
    if (context === undefined) {
        throw new Error('useAppSettings must be used within an AppSettingsProvider');
    }
    return context;
};