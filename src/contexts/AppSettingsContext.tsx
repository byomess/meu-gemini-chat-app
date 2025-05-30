import React, { createContext, useContext, type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { HarmCategory, HarmBlockThreshold, type SafetySetting } from '../types';
import type { AppSettings, GeminiModelConfig, FunctionDeclaration, GoogleDriveSyncStatus, GoogleDriveUser, ThemeName } from '../types';
import { ALL_THEME_NAMES, DARK_THEME_NAMES } from '../constants/themes'; // NEW: Import theme constants
import { nativeFunctionDeclarations } from '../config/nativeFunctions'; // ADDED: Import native functions

const APP_SETTINGS_KEY = 'geminiChat_appSettings';

export const DEFAULT_PERSONALITY_PROMPT = `Você é Loox, um assistente de IA pessoal projetado para ser um parceiro inteligente, prestativo e adaptável, operando dentro deste Web App. Sua missão é auxiliar os usuários em diversas tarefas, produtividade, explorar ideias e manter uma interação engajante e personalizada.`;

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
        thinkingBudget: 1024,
    },
    functionDeclarations: [], // Represents user-defined functions; native functions are merged in
    codeSynthaxHighlightEnabled: false,
    aiAvatarUrl: '/lux_avatar.png',
    enableWebSearch: true,
    enableAttachments: true,
    hideNavigation: false,
    theme: 'loox',
    showProcessingIndicators: true,
    googleDriveAccessToken: undefined,
    googleDriveUser: null,
    googleDriveSyncStatus: 'Disconnected',
    googleDriveLastSync: undefined,
    googleDriveError: undefined,
    showAiFunctionCallAttachments: true
};

interface AppSettingsContextType {
    settings: AppSettings; // This will contain the combined (native + user) function declarations
    setSettings: (settings: AppSettings | ((prevSettings: AppSettings) => AppSettings)) => void;
    saveApiKey: (apiKey: string) => void;
    updateGeminiModelConfig: (config: Partial<GeminiModelConfig>) => void;
    updateFunctionDeclarations: (declarations: FunctionDeclaration[]) => void; // Will receive combined, saves only user-defined
    updateCodeSyntaxHighlightEnabled: (enabled: boolean) => void;
    updateAiAvatarUrl: (url: string) => void;
    updateEnableWebSearch: (enabled: boolean) => void;
    updateAttachmentsEnabled: (enabled: boolean) => void;
    updateHideNavigation: (hidden: boolean) => void;
    updateTheme: (theme: ThemeName) => void;
    updateShowProcessingIndicators: (enabled: boolean) => void;
    connectGoogleDrive: (accessToken: string, user: GoogleDriveUser) => void;
    disconnectGoogleDrive: () => void;
    setGoogleDriveSyncStatus: (status: GoogleDriveSyncStatus) => void;
    updateGoogleDriveLastSync: (timestamp: string) => void;
    setGoogleDriveError: (error?: string) => void;
}

export const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [storedSettings, setStoredSettings] = useLocalStorage<AppSettings>(
        APP_SETTINGS_KEY,
        defaultAppSettings
    );

    // Memoize the combined list of function declarations
    // This list merges native functions with user-defined functions from storage
    const combinedFunctionDeclarations = useMemo(() => {
        const userDefinedFunctionsFromStorage = storedSettings.functionDeclarations || [];
        
        // Filter out any user-defined functions that might have the same ID as a native function
        // This gives precedence to native functions.
        const uniqueUserDefinedFunctions = userDefinedFunctionsFromStorage.filter(
            udf => !nativeFunctionDeclarations.some(nf => nf.id === udf.id)
        );

        return [...nativeFunctionDeclarations, ...uniqueUserDefinedFunctions];
    }, [storedSettings.functionDeclarations]);

    // Effective settings to be passed down through context
    // This includes the combined list of function declarations
    const effectiveSettings = useMemo(() => ({
        ...storedSettings,
        functionDeclarations: combinedFunctionDeclarations,
    }), [storedSettings, combinedFunctionDeclarations]);

    useEffect(() => {
        // Manage body class for themes.
        const THEMES_ON_BODY = ALL_THEME_NAMES.map(name => `theme-${name}`);
        const currentTheme = effectiveSettings.theme && ALL_THEME_NAMES.includes(effectiveSettings.theme)
            ? effectiveSettings.theme
            : defaultAppSettings.theme;

        document.body.classList.remove(...THEMES_ON_BODY);
        document.body.classList.add(`theme-${currentTheme}`);

        if (DARK_THEME_NAMES.includes(currentTheme)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [effectiveSettings.theme]);

    useEffect(() => {
        if (effectiveSettings && effectiveSettings.geminiModelConfig) {
            let needsUpdate = false;
            let currentSafetySettings = effectiveSettings.geminiModelConfig.safetySettings;

            const allCategoriesPresent = defaultSafetySettings.every(defaultSetting =>
                currentSafetySettings && currentSafetySettings.find(s => s.category === defaultSetting.category)
            );

            if (!allCategoriesPresent) {
                currentSafetySettings = [...defaultSafetySettings.map(s => ({...s}))];
                needsUpdate = true;
            }

            if (needsUpdate) {
                setStoredSettings(prevSettings => ({
                    ...prevSettings,
                    geminiModelConfig: {
                        ...prevSettings.geminiModelConfig,
                        safetySettings: currentSafetySettings,
                    },
                }));
            }
        }
    }, [effectiveSettings.geminiModelConfig?.safetySettings, setStoredSettings]);

    const saveApiKey = useCallback((apiKey: string) => {
        setStoredSettings((prevSettings) => ({ ...prevSettings, apiKey }));
    }, [setStoredSettings]);

    const updateGeminiModelConfig = useCallback((configUpdate: Partial<GeminiModelConfig>) => {
        setStoredSettings((prevSettings) => {
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
    }, [setStoredSettings]);

    const updateFunctionDeclarations = useCallback((newDeclarations: FunctionDeclaration[]) => {
        // Filter out native functions before saving to local storage.
        // newDeclarations might be the combined list from the UI.
        const userDefinedDeclarationsToSave = newDeclarations.filter(
            decl => !decl.isNative
        );
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            // Only user-defined functions are stored in localStorage.
            functionDeclarations: userDefinedDeclarationsToSave,
        }));
    }, [setStoredSettings]);

    const updateCodeSyntaxHighlightEnabled = useCallback((enabled: boolean) => {
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            codeSynthaxHighlightEnabled: enabled,
        }));
    }, [setStoredSettings]);

    const updateAiAvatarUrl = useCallback((url: string) => {
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            aiAvatarUrl: url,
        }));
    }, [setStoredSettings]);

    const updateEnableWebSearch = useCallback((enabled: boolean) => {
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            enableWebSearch: enabled,
        }));
    }, [setStoredSettings]);

    const updateAttachmentsEnabled = useCallback((enabled: boolean) => {
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            enableAttachments: enabled,
        }));
    }, [setStoredSettings]);

    const updateHideNavigation = useCallback((hidden: boolean) => {
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            hideNavigation: hidden,
        }));
    }, [setStoredSettings]);

    const updateTheme = useCallback((theme: ThemeName) => {
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            theme: theme,
        }));
    }, [setStoredSettings]);

    const updateShowProcessingIndicators = useCallback((enabled: boolean) => {
        setStoredSettings((prevSettings) => ({
            ...prevSettings,
            showProcessingIndicators: enabled,
        }));
    }, [setStoredSettings]);

    const connectGoogleDrive = useCallback((accessToken: string, user: GoogleDriveUser) => {
        setStoredSettings(prev => ({
            ...prev,
            googleDriveAccessToken: accessToken,
            googleDriveUser: user,
            googleDriveSyncStatus: 'Synced',
            googleDriveLastSync: new Date().toISOString(),
            googleDriveError: undefined,
        }));
    }, [setStoredSettings]);

    const disconnectGoogleDrive = useCallback(() => {
        setStoredSettings(prev => ({
            ...prev,
            googleDriveAccessToken: undefined,
            googleDriveUser: null,
            googleDriveSyncStatus: 'Disconnected',
            googleDriveError: undefined,
        }));
    }, [setStoredSettings]);

    const setGoogleDriveSyncStatus = useCallback((status: GoogleDriveSyncStatus) => {
        setStoredSettings(prev => ({ ...prev, googleDriveSyncStatus: status }));
    }, [setStoredSettings]);

    const updateGoogleDriveLastSync = useCallback((timestamp: string) => {
        setStoredSettings(prev => ({ ...prev, googleDriveLastSync: timestamp }));
    }, [setStoredSettings]);

    const setGoogleDriveError = useCallback((error?: string) => {
        setStoredSettings(prev => ({ ...prev, googleDriveError: error, googleDriveSyncStatus: error ? 'Error' : prev.googleDriveSyncStatus }));
    }, [setStoredSettings]);


    return (
        <AppSettingsContext.Provider value={{
            settings: effectiveSettings, // Provide the settings with combined function declarations
            setSettings: setStoredSettings, // This updates the raw stored settings
            saveApiKey,
            updateGeminiModelConfig,
            updateFunctionDeclarations, // This correctly filters before saving
            updateCodeSyntaxHighlightEnabled,
            updateAiAvatarUrl,
            updateEnableWebSearch,
            updateAttachmentsEnabled,
            updateHideNavigation,
            updateTheme,
            updateShowProcessingIndicators,
            connectGoogleDrive,
            disconnectGoogleDrive,
            setGoogleDriveSyncStatus,
            updateGoogleDriveLastSync,
            setGoogleDriveError,
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
