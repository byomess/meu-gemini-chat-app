import React, { createContext, useContext, type ReactNode, useCallback, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { HarmCategory, HarmBlockThreshold, type SafetySetting } from '../types';
import type { AppSettings, GeminiModelConfig, FunctionDeclaration } from '../types';

const APP_SETTINGS_KEY = 'geminiChat_appSettings';

export const DEFAULT_PERSONALITY_PROMPT = `Você é uma IA professora / tutora de alunos que estão fazendo cursos na plataforma de ensino à distância Aulapp, e seu papel é ajudar os alunos a entenderem melhor o conteúdo do curso, responder perguntas e fornecer feedback sobre a evolução deles. Você deve ser amigável, paciente e encorajador, sempre buscando ajudar os alunos a aprenderem e se desenvolverem.`;

const defaultSafetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const defaultAppSettings: AppSettings = {
    apiKey: '',
    customPersonalityPrompt: DEFAULT_PERSONALITY_PROMPT,
    geminiModelConfig: {
        temperature: 0.90,
        topP: 0.95,
        topK: 0,
        maxOutputTokens: 32768,
        safetySettings: defaultSafetySettings,
        model: 'gemini-2.5-flash-preview-05-20',
        thinkingBudget: 1024, // Add this line with a default value
    },
    functionDeclarations: [],
    codeSynthaxHighlightEnabled: false,
    aiAvatarUrl: '',
    enableWebSearch: true,
    enableAttachments: true,
    hideNavigation: false,
    theme: 'aulapp',
};

interface AppSettingsContextType {
    settings: AppSettings;
    setSettings: (settings: AppSettings | ((prevSettings: AppSettings) => AppSettings)) => void;
    saveApiKey: (apiKey: string) => void;
    updateGeminiModelConfig: (config: Partial<GeminiModelConfig>) => void;
    updateFunctionDeclarations: (declarations: FunctionDeclaration[]) => void;
    updateCodeSyntaxHighlightEnabled: (enabled: boolean) => void;
    updateAiAvatarUrl: (url: string) => void;
    updateEnableWebSearch: (enabled: boolean) => void;
    updateAttachmentsEnabled: (enabled: boolean) => void;
    updateHideNavigation: (hidden: boolean) => void;
    updateTheme: (theme: 'loox' | 'aulapp') => void;
}

export const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useLocalStorage<AppSettings>(
        APP_SETTINGS_KEY,
        defaultAppSettings
    );

    useEffect(() => {
        document.body.classList.remove('theme-loox', 'theme-aulapp');
        document.body.classList.add(`theme-${settings.theme}`);
    }, [settings.theme]);

    React.useEffect(() => {
        if (settings && settings.geminiModelConfig) {
            let needsUpdate = false;
            let currentSafetySettings = settings.geminiModelConfig.safetySettings;

            if (!currentSafetySettings || currentSafetySettings.length !== defaultSafetySettings.length) {
                currentSafetySettings = defaultSafetySettings;
                needsUpdate = true;
            } else {
                for (const defaultSetting of defaultSafetySettings) {
                    if (!currentSafetySettings.find(s => s.category === defaultSetting.category)) {
                        currentSafetySettings = defaultSafetySettings;
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
    }, [settings.geminiModelConfig?.safetySettings]);

    const saveApiKey = useCallback((apiKey: string) => {
        setSettings((prevSettings) => ({ ...prevSettings, apiKey }));
    }, [setSettings]);

    const updateGeminiModelConfig = useCallback((configUpdate: Partial<GeminiModelConfig>) => {
        setSettings((prevSettings) => {
            const newModelConfig = {
                ...prevSettings.geminiModelConfig,
                ...configUpdate,
            };
            if (!newModelConfig.safetySettings || !Array.isArray(newModelConfig.safetySettings)) {
                newModelConfig.safetySettings = defaultSafetySettings;
            }
            return {
                ...prevSettings,
                geminiModelConfig: newModelConfig,
            };
        });
    }, [setSettings]);

    const updateFunctionDeclarations = useCallback((declarations: FunctionDeclaration[]) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            functionDeclarations: declarations,
        }));
    }, [setSettings]);

    const updateCodeSyntaxHighlightEnabled = useCallback((enabled: boolean) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            codeSynthaxHighlightEnabled: enabled,
        }));
    }, [setSettings]);

    const updateAiAvatarUrl = useCallback((url: string) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            aiAvatarUrl: url,
        }));
    }, [setSettings]);

    const updateEnableWebSearch = useCallback((enabled: boolean) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            enableWebSearch: enabled,
        }));
    }, [setSettings]);

    const updateAttachmentsEnabled = useCallback((enabled: boolean) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            enableAttachments: enabled,
        }));
    }, [setSettings]);

    const updateHideNavigation = useCallback((hidden: boolean) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            hideNavigation: hidden,
        }));
    }, [setSettings]);

    const updateTheme = useCallback((theme: 'loox' | 'aulapp') => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            theme: theme,
        }));
    }, [setSettings]);

    return (
        <AppSettingsContext.Provider value={{
            settings,
            setSettings,
            saveApiKey,
            updateGeminiModelConfig,
            updateFunctionDeclarations,
            updateCodeSyntaxHighlightEnabled,
            updateAiAvatarUrl,
            updateEnableWebSearch,
            updateAttachmentsEnabled,
            updateHideNavigation,
            updateTheme,
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
