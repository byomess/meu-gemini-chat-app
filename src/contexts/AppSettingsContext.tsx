// src/contexts/AppSettingsContext.tsx
import React, { createContext, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { AppSettings, GeminiModelConfig, GeminiModel, FunctionDeclaration } from '../types';

const APP_SETTINGS_KEY = 'geminiChat_appSettings';

const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-2.5-pro-preview-05-06";

export const DEFAULT_PERSONALITY_PROMPT = `Você é Loox, um assistente de IA pessoal projetado para ser um parceiro inteligente, prestativo e adaptável, operando dentro deste Web App. Sua missão é auxiliar os usuários em diversas tarefas, produtividade, explorar ideias e manter uma interação engajadora e personalizada.`;

const defaultAppSettings: AppSettings = {
    apiKey: '',
    theme: 'dark',
    customPersonalityPrompt: DEFAULT_PERSONALITY_PROMPT,
    geminiModelConfig: {
        model: DEFAULT_GEMINI_MODEL,
        temperature: 0.90,
        topP: 0.95,
        topK: 8,
        maxOutputTokens: 32768,
    },
    functionDeclarations: [], // Adicionado
};

interface AppSettingsContextType {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    saveApiKey: (apiKey: string) => void;
    updateGeminiModelConfig: (config: Partial<GeminiModelConfig>) => void;
    updateFunctionDeclarations: (declarations: FunctionDeclaration[]) => void; // Adicionado
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useLocalStorage<AppSettings>(
        APP_SETTINGS_KEY,
        defaultAppSettings
    );

    const saveApiKey = (apiKey: string) => {
        setSettings((prevSettings) => ({ ...prevSettings, apiKey }));
    };

    const updateGeminiModelConfig = (configUpdate: Partial<GeminiModelConfig>) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            geminiModelConfig: {
                ...prevSettings.geminiModelConfig,
                ...configUpdate,
            },
        }));
    };

    const updateFunctionDeclarations = (declarations: FunctionDeclaration[]) => { // Adicionado
        setSettings((prevSettings) => ({
            ...prevSettings,
            functionDeclarations: declarations,
        }));
    };

    return (
        <AppSettingsContext.Provider value={{
            settings,
            setSettings,
            saveApiKey,
            updateGeminiModelConfig,
            updateFunctionDeclarations // Adicionado
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
