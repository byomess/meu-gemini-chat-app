import React, { createContext, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { AppSettings } from '../types';

const APP_SETTINGS_KEY = 'geminiChat_appSettings';

const defaultAppSettings: AppSettings = {
    apiKey: '',
    theme: 'dark',
};

interface AppSettingsContextType {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    saveApiKey: (apiKey: string) => void;
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

    // Poderíamos adicionar uma função para mudar o tema aqui também, se necessário
    // useEffect(() => {
    //   if (settings.theme === 'dark') {
    //     document.documentElement.classList.add('dark');
    //   } else {
    //     document.documentElement.classList.remove('dark');
    //   }
    // }, [settings.theme]);
    // A classe 'dark' já está no HTML, então este useEffect é mais para alternância de tema.

    return (
        <AppSettingsContext.Provider value={{ settings, setSettings, saveApiKey }}>
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