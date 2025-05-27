import React, { createContext, useContext, type ReactNode, useCallback, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { HarmCategory, HarmBlockThreshold, type SafetySetting } from '../types';
import type { AppSettings, GeminiModelConfig, FunctionDeclaration, GoogleDriveSyncStatus, GoogleDriveUser, ThemeName } from '../types'; // MODIFIED: Import ThemeName

const APP_SETTINGS_KEY = 'geminiChat_appSettings';

export const DEFAULT_PERSONALITY_PROMPT = `Você é Loox, um assistente de IA pessoal projetado para ser um parceiro inteligente, prestativo e adaptável, operando dentro deste Web App. Sua missão é auxiliar os usuários em diversas tarefas, produtividade, explorar ideias e manter uma interação engajadora e personalizada.`;

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
    functionDeclarations: [],
    codeSynthaxHighlightEnabled: false,
    aiAvatarUrl: '',
    enableWebSearch: true,
    enableAttachments: true,
    hideNavigation: false,
    theme: 'loox', // MODIFIED: Default theme
    showProcessingIndicators: true,
    googleDriveAccessToken: undefined,
    googleDriveUser: null,
    googleDriveSyncStatus: 'Disconnected',
    googleDriveLastSync: undefined,
    googleDriveError: undefined,
    showAiFunctionCallAttachments: true
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
    updateTheme: (theme: ThemeName) => void; // MODIFIED: Use ThemeName
    updateShowProcessingIndicators: (enabled: boolean) => void; // Add this line
    connectGoogleDrive: (accessToken: string, user: GoogleDriveUser) => void;
    disconnectGoogleDrive: () => void;
    setGoogleDriveSyncStatus: (status: GoogleDriveSyncStatus) => void;
    updateGoogleDriveLastSync: (timestamp: string) => void;
    setGoogleDriveError: (error?: string) => void;
}

export const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useLocalStorage<AppSettings>(
        APP_SETTINGS_KEY,
        defaultAppSettings
    );

    useEffect(() => {
        // Manage body class for themes.
        // The initial class is set by an inline script in index.html to prevent FOUC.
        // This effect handles subsequent theme changes during the app lifecycle.
        const themesToRemove = ['theme-loox', 'theme-aulapp', 'theme-dracula-dark'];
        document.body.classList.remove(...themesToRemove);

        if (settings.theme) {
            document.body.classList.add(`theme-${settings.theme}`);
        }
    }, [settings.theme]);

    React.useEffect(() => {
        if (settings && settings.geminiModelConfig) {
            let needsUpdate = false;
            let currentSafetySettings = settings.geminiModelConfig.safetySettings;

            // Check if all categories defined in defaultSafetySettings are present in currentSafetySettings
            const allCategoriesPresent = defaultSafetySettings.every(defaultSetting =>
                currentSafetySettings && currentSafetySettings.find(s => s.category === defaultSetting.category)
            );

            if (!allCategoriesPresent) {
                // If not all default categories are present, then reset to the context's defaultSafetySettings.
                // This ensures a baseline of safety categories is always configured.
                // console.log("AppSettingsContext: Resetting safety settings to default due to missing categories.");
                currentSafetySettings = [...defaultSafetySettings.map(s => ({...s}))]; // Ensure new array and objects
                needsUpdate = true;
            }
            // If allCategoriesPresent is true, we assume the existing currentSafetySettings
            // (potentially from configUrl) are intentional, even if thresholds differ from context's defaults.
            // No 'else' block that forces needsUpdate = true based on threshold differences alone.

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
    }, [settings.geminiModelConfig?.safetySettings, setSettings]); // Added setSettings to dependency array

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

    const updateTheme = useCallback((theme: ThemeName) => { // MODIFIED: Use ThemeName
        setSettings((prevSettings) => ({
            ...prevSettings,
            theme: theme,
        }));
    }, [setSettings]);

    // Add this new callback
    const updateShowProcessingIndicators = useCallback((enabled: boolean) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            showProcessingIndicators: enabled,
        }));
    }, [setSettings]);

    const connectGoogleDrive = useCallback((accessToken: string, user: GoogleDriveUser) => {
        setSettings(prev => ({
            ...prev,
            googleDriveAccessToken: accessToken,
            googleDriveUser: user,
            googleDriveSyncStatus: 'Synced', // Or 'Connected', assuming initial sync might follow
            googleDriveLastSync: new Date().toISOString(),
            googleDriveError: undefined,
        }));
    }, [setSettings]);

    const disconnectGoogleDrive = useCallback(() => {
        setSettings(prev => ({
            ...prev,
            googleDriveAccessToken: undefined,
            googleDriveUser: null,
            googleDriveSyncStatus: 'Disconnected',
            googleDriveError: undefined,
            // googleDriveLastSync: undefined, // Optionally clear last sync time
        }));
    }, [setSettings]);

    const setGoogleDriveSyncStatus = useCallback((status: GoogleDriveSyncStatus) => {
        setSettings(prev => ({ ...prev, googleDriveSyncStatus: status }));
    }, [setSettings]);

    const updateGoogleDriveLastSync = useCallback((timestamp: string) => {
        setSettings(prev => ({ ...prev, googleDriveLastSync: timestamp }));
    }, [setSettings]);

    const setGoogleDriveError = useCallback((error?: string) => {
        setSettings(prev => ({ ...prev, googleDriveError: error, googleDriveSyncStatus: error ? 'Error' : prev.googleDriveSyncStatus }));
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
            updateShowProcessingIndicators, // Add this to the context value
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
