// src/contexts/AppSettingsContext.tsx
import React, { createContext, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { AppSettings, GeminiModelConfig, GeminiModel } from '../types';

const APP_SETTINGS_KEY = 'geminiChat_appSettings';

const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-2.5-pro-preview-05-06";

const defaultAppSettings: AppSettings = {
    apiKey: '',
    theme: 'dark',
    geminiModelConfig: {
        model: DEFAULT_GEMINI_MODEL,
        temperature: 0.90,
        topP: 0.95,
        topK: 8,
        maxOutputTokens: 32768,
    },
};

interface AppSettingsContextType {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    saveApiKey: (apiKey: string) => void;
    // Adicionar uma função para atualizar geminiModelConfig pode ser útil
    updateGeminiModelConfig: (config: Partial<GeminiModelConfig>) => void;
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
                ...prevSettings.geminiModelConfig, // Preserva as configurações existentes
                ...configUpdate,                   // Aplica as atualizações
            },
        }));
    };

    return (
        <AppSettingsContext.Provider value={{ settings, setSettings, saveApiKey, updateGeminiModelConfig }}>
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