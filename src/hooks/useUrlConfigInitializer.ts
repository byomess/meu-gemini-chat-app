import { useEffect, useState, useContext, useRef } from 'react';
import type { AppSettings, GeminiModelConfig, FunctionDeclaration, Memory, SafetySetting } from '../types';
import { AppSettingsContext } from '../contexts/AppSettingsContext';
import { MemoryContext } from '../contexts/MemoryContext';
import { v4 as uuidv4 } from 'uuid';
import { HarmCategory as GenaiHarmCategoryEnum, HarmBlockThreshold as GenaiHarmBlockThresholdEnum } from "@google/genai";

const DEFAULT_HARM_CATEGORIES_FOR_HOOK: { id: string }[] = [
    { id: GenaiHarmCategoryEnum.HARM_CATEGORY_HARASSMENT },
    { id: GenaiHarmCategoryEnum.HARM_CATEGORY_HATE_SPEECH },
    { id: GenaiHarmCategoryEnum.HARM_CATEGORY_SEXUALLY_EXPLICIT },
    { id: GenaiHarmCategoryEnum.HARM_CATEGORY_DANGEROUS_CONTENT },
];

const FALLBACK_DEFAULT_SAFETY_SETTINGS_FOR_HOOK: SafetySetting[] = DEFAULT_HARM_CATEGORIES_FOR_HOOK.map(cat => ({
    category: cat.id as SafetySetting['category'],
    threshold: GenaiHarmBlockThresholdEnum.BLOCK_NONE,
}));

interface UrlConfigFileMemory {
    id?: string;
    content: string;
    timestamp: string; // ISO string
    sourceMessageId?: string;
}

interface UrlConfigFile {
    apiKey?: string;
    geminiModelConfig?: Partial<GeminiModelConfig>;
    customPersonalityPrompt?: string;
    functionDeclarations?: FunctionDeclaration[];
    aiAvatarUrl?: string;
    memories?: UrlConfigFileMemory[];
    codeSynthaxHighlightEnabled?: boolean;
    enableWebSearch?: boolean;
    enableAttachments?: boolean;
    hideNavigation?: boolean; // Added new setting
    showProcessingIndicators?: boolean;
    showAiFunctionCallAttachments?: boolean; // New setting
}

// Helper for basic deep comparison of JSON-like objects
function areObjectsEffectivelyEqual(objA: Record<string, unknown>, objB: Record<string, unknown>): boolean {
    if (objA === objB) return true;
    if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
        return false;
    }
    // Using JSON.stringify for simplicity; consider a more robust deep-equal library for complex cases
    return JSON.stringify(objA) === JSON.stringify(objB);
}


export function useUrlConfigInitializer() {
    const appSettingsContext = useContext(AppSettingsContext);
    const memoryContext = useContext(MemoryContext);

    const processedSearchStringRef = useRef<string | null>(null); // Ref to track processed search strings

    // Destructure methods from contexts. These should have stable references if provided correctly.
    const setSettings = appSettingsContext?.setSettings;
    const replaceAllMemories = memoryContext?.replaceAllMemories;

    const fetchedUrlConfigDataRef = useRef<{ url: string, data: UrlConfigFile } | null>(null);
    const decodedFuncDeclDataRef = useRef<{ urlEncodedString: string, data: FunctionDeclaration } | null>(null); 

    const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
    const [configError, setConfigError] = useState<string | null>(null);

    useEffect(() => {
        const currentSearch = window.location.search;

        if (processedSearchStringRef.current === currentSearch) {
            // console.log("Configuration for current search string already processed. Skipping effect.", currentSearch);
            return; 
        }

        // console.log("useUrlConfigInitializer effect triggered. Processing search:", currentSearch);

        if (!appSettingsContext) { 
            console.error("CRITICAL: AppSettingsContext not found in useUrlConfigInitializer.");
            setConfigError("AppSettingsContext not found.");
            setIsLoadingConfig(false);
            processedSearchStringRef.current = currentSearch; // Mark as processed
            return;
        }
        if (!memoryContext) {
            console.error("CRITICAL: MemoryContext not found in useUrlConfigInitializer.");
            setConfigError("MemoryContext not found.");
            setIsLoadingConfig(false);
            processedSearchStringRef.current = currentSearch; // Mark as processed
            return;
        }
        
        if (!setSettings) {
            console.error("CRITICAL: setSettings method not available from AppSettingsContext.");
            setConfigError("setSettings method not available.");
            setIsLoadingConfig(false);
            processedSearchStringRef.current = currentSearch; // Mark as processed
            return;
        }
        // replaceAllMemories is checked before use if configToApply.memories is present.

        const params = new URLSearchParams(currentSearch);
        const configUrl = params.get('configUrl');
        const functionDeclarationUrlEncoded = params.get('functionDeclarationUrlEncoded'); 

        if (!configUrl && !functionDeclarationUrlEncoded) {
            // Only clear refs if they were potentially set by a previous run with a configUrl
            if (fetchedUrlConfigDataRef.current || decodedFuncDeclDataRef.current) {
                console.log("No configUrl or functionDeclarationUrlEncoded query parameter found. Clearing states and cached data.");
                fetchedUrlConfigDataRef.current = null;
                decodedFuncDeclDataRef.current = null;
                // Optionally, reset parts of app settings if appropriate when config is removed.
                // For now, just clearing local cache and loading states.
            }
            setIsLoadingConfig(false);
            setConfigError(null);
            return;
        }

        const processAndApply = async () => {
            setIsLoadingConfig(true);
            let operationError: string | null = null; 

            console.log("Starting processAndApply cycle for URL parameters:", currentSearch);

            try {
                // --- Step 1: Fetch configUrl if new, changed, or not yet fetched ---
                if (configUrl) {
                    if (!fetchedUrlConfigDataRef.current || fetchedUrlConfigDataRef.current.url !== configUrl) {
                        console.log(`Fetching configuration from configUrl: ${configUrl}`);
                        const response = await fetch(configUrl);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch config from ${configUrl}: ${response.status} ${response.statusText}`);
                        }
                        const data = await response.json() as UrlConfigFile;
                        fetchedUrlConfigDataRef.current = { url: configUrl, data };
                        console.log("ConfigUrl data fetched and cached:", JSON.stringify(data, null, 2));
                        setConfigError(null); 
                    } else {
                        console.log("Using cached configUrl data for:", configUrl);
                    }
                } else {
                    // If configUrl is removed from query params, clear its cached data.
                    if (fetchedUrlConfigDataRef.current) {
                        console.log("configUrl parameter removed, clearing cached configUrl data.");
                        fetchedUrlConfigDataRef.current = null;
                        // Potentially reset settings derived from this configUrl if desired.
                    }
                }

                // --- Step 2: Decode functionDeclarationUrlEncoded if new, changed, or not yet decoded ---
                if (functionDeclarationUrlEncoded) {
                    if (!decodedFuncDeclDataRef.current || decodedFuncDeclDataRef.current.urlEncodedString !== functionDeclarationUrlEncoded) {
                        console.log("Decoding functionDeclarationUrlEncoded.");
                        const decodedJson = decodeURIComponent(functionDeclarationUrlEncoded); 
                        const parsedInput = JSON.parse(decodedJson) as Partial<FunctionDeclaration>;
                        console.log("Decoded function declaration from URL encoded string:", JSON.stringify(parsedInput, null, 2));

                        if (!parsedInput || typeof parsedInput.name !== 'string' || parsedInput.name.trim() === "") {
                            throw new Error("Invalid FunctionDeclaration from URL encoded string: 'name' is missing or invalid.");
                        }
                        
                        const newFuncDecl: FunctionDeclaration = {
                            id: parsedInput.id || uuidv4(),
                            name: parsedInput.name,
                            description: parsedInput.description || "",
                            parametersSchema: parsedInput.parametersSchema || "{}",
                            endpointUrl: parsedInput.endpointUrl || "",
                            httpMethod: parsedInput.httpMethod || "GET",
                        };

                        const validHttpMethods: Array<FunctionDeclaration['httpMethod']> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
                        if (!validHttpMethods.includes(newFuncDecl.httpMethod)) {
                            console.warn(`Invalid httpMethod "${newFuncDecl.httpMethod}" in functionDeclarationUrlEncoded. Defaulting to GET.`);
                            newFuncDecl.httpMethod = 'GET';
                        }
                        
                        decodedFuncDeclDataRef.current = { urlEncodedString: functionDeclarationUrlEncoded, data: newFuncDecl };
                        console.log("FunctionDeclaration from URL encoded string decoded and cached.");
                        setConfigError(null); 
                    } else {
                        console.log("Using cached functionDeclarationUrlEncoded data.");
                    }
                } else {
                    // If functionDeclarationUrlEncoded is removed, clear its cached data.
                    if (decodedFuncDeclDataRef.current) {
                        console.log("functionDeclarationUrlEncoded parameter removed, clearing cached function data.");
                        decodedFuncDeclDataRef.current = null;
                        // Potentially update settings to remove this function declaration if desired.
                    }
                }

                // --- Step 3: Apply configurations from cached refs to the context ---
                // This part will run even if data is from cache, to ensure settings are applied.
                // The setSettings internal logic should prevent unnecessary updates if data is identical.
                if (fetchedUrlConfigDataRef.current) {
                    const configToApply = fetchedUrlConfigDataRef.current.data;
                    console.log("Attempting to apply cached configUrl data to AppSettingsContext.");
                    setSettings((prevSettings: AppSettings) => {
                        let changed = false;
                        const newAppSettings: AppSettings = { ...prevSettings };

                        if (configToApply.apiKey !== undefined && newAppSettings.apiKey !== configToApply.apiKey) {
                            newAppSettings.apiKey = configToApply.apiKey;
                            changed = true;
                        }
                        if (configToApply.customPersonalityPrompt !== undefined && newAppSettings.customPersonalityPrompt !== configToApply.customPersonalityPrompt) {
                            newAppSettings.customPersonalityPrompt = configToApply.customPersonalityPrompt;
                            changed = true;
                        }
                        if (configToApply.functionDeclarations !== undefined) {
                            const newDeclarations = configToApply.functionDeclarations.map(fd => ({ ...fd, id: fd.id || uuidv4() }));
                            if (!areObjectsEffectivelyEqual(
                                { functionDeclarations: newAppSettings.functionDeclarations },
                                { functionDeclarations: newDeclarations }
                            )) {
                                newAppSettings.functionDeclarations = newDeclarations;
                                changed = true;
                            }
                        }
                        if (configToApply.aiAvatarUrl !== undefined && newAppSettings.aiAvatarUrl !== configToApply.aiAvatarUrl) {
                            newAppSettings.aiAvatarUrl = configToApply.aiAvatarUrl;
                            changed = true;
                        }
                        if (configToApply.codeSynthaxHighlightEnabled !== undefined && newAppSettings.codeSynthaxHighlightEnabled !== configToApply.codeSynthaxHighlightEnabled) {
                            newAppSettings.codeSynthaxHighlightEnabled = configToApply.codeSynthaxHighlightEnabled;
                            changed = true;
                        }
                        if (configToApply.enableWebSearch !== undefined && newAppSettings.enableWebSearch !== configToApply.enableWebSearch) {
                            newAppSettings.enableWebSearch = configToApply.enableWebSearch;
                            changed = true;
                        }
                        if (configToApply.enableAttachments !== undefined && newAppSettings.enableAttachments !== configToApply.enableAttachments) {
                            newAppSettings.enableAttachments = configToApply.enableAttachments;
                            changed = true;
                        }
                        if (configToApply.hideNavigation !== undefined && newAppSettings.hideNavigation !== configToApply.hideNavigation) {
                            newAppSettings.hideNavigation = configToApply.hideNavigation;
                            changed = true;
                        }
                        if (configToApply.showProcessingIndicators !== undefined && newAppSettings.showProcessingIndicators !== configToApply.showProcessingIndicators) {
                            newAppSettings.showProcessingIndicators = configToApply.showProcessingIndicators;
                            changed = true;
                        }
                        if (configToApply.showAiFunctionCallAttachments !== undefined && newAppSettings.showAiFunctionCallAttachments !== configToApply.showAiFunctionCallAttachments) {
                            newAppSettings.showAiFunctionCallAttachments = configToApply.showAiFunctionCallAttachments;
                            changed = true;
                        }

                        if (configToApply.geminiModelConfig) {
                            const baseModelConfig = prevSettings.geminiModelConfig;
                            const tentativeMergedModelConfig: GeminiModelConfig = { ...baseModelConfig, ...configToApply.geminiModelConfig };
                            
                            if (configToApply.geminiModelConfig.safetySettings !== undefined) {
                                if (Array.isArray(configToApply.geminiModelConfig.safetySettings)) {
                                    const urlSafetySettings = configToApply.geminiModelConfig.safetySettings;
                                    tentativeMergedModelConfig.safetySettings = FALLBACK_DEFAULT_SAFETY_SETTINGS_FOR_HOOK.map(defaultSS => {
                                        const providedSS = urlSafetySettings.find(urlSS => urlSS.category === defaultSS.category);
                                        return providedSS ? { ...providedSS } : { ...defaultSS };
                                    });
                                } else {
                                    tentativeMergedModelConfig.safetySettings = FALLBACK_DEFAULT_SAFETY_SETTINGS_FOR_HOOK.map(s => ({ ...s }));
                                }
                            } else if (baseModelConfig.safetySettings) {
                                tentativeMergedModelConfig.safetySettings = baseModelConfig.safetySettings.map(s => ({ ...s }));
                            } else {
                                tentativeMergedModelConfig.safetySettings = FALLBACK_DEFAULT_SAFETY_SETTINGS_FOR_HOOK.map(s => ({ ...s }));
                            }
                            
                            if (!areObjectsEffectivelyEqual(newAppSettings.geminiModelConfig as unknown as Record<string, unknown>, tentativeMergedModelConfig as unknown as Record<string, unknown>)) {
                                newAppSettings.geminiModelConfig = tentativeMergedModelConfig;
                                changed = true;
                            }
                        }
                        
                        if (changed) {
                            console.log("AppSettings updated from configUrl data:", JSON.stringify(newAppSettings, null, 2));
                            return newAppSettings;
                        }
                        console.log("Skipping AppSettings update from configUrl, no effective changes needed.");
                        return prevSettings;
                    });

                    if (configToApply.memories && replaceAllMemories) {
                        console.log("Attempting to apply cached memories from configUrl data.");
                        const parsedMemories: Memory[] = configToApply.memories.map(mem => {
                            if (typeof mem.content !== 'string' || typeof mem.timestamp !== 'string') {
                                console.warn("Skipping invalid memory object from configUrl (missing content or timestamp string):", mem);
                                return null;
                            }
                            const timestampDate = new Date(mem.timestamp);
                            if (isNaN(timestampDate.getTime())) {
                                console.warn("Skipping invalid memory object from configUrl (invalid timestamp string):", mem);
                                return null;
                            }
                            return { id: mem.id || uuidv4(), content: mem.content, timestamp: timestampDate, sourceMessageId: mem.sourceMessageId };
                        }).filter(mem => mem !== null) as Memory[];
                        
                        // Assuming replaceAllMemories is idempotent or handles existing memories appropriately.
                        replaceAllMemories(parsedMemories);
                        console.log("Memories applied from configUrl data:", parsedMemories.length, "memories.");
                    }
                }

                if (decodedFuncDeclDataRef.current) {
                    const funcDeclToApply = decodedFuncDeclDataRef.current.data;
                    console.log("Attempting to apply cached functionDeclarationUrlEncoded data to AppSettingsContext.");
                    setSettings((prevSettings: AppSettings) => {
                        const currentDeclarations = prevSettings.functionDeclarations ? [...prevSettings.functionDeclarations] : [];
                        const newDeclarations = [...currentDeclarations];
                        let existingIndex = newDeclarations.findIndex(fd => fd.id === funcDeclToApply.id);
                        if (existingIndex === -1) { 
                            existingIndex = newDeclarations.findIndex(fd => fd.name === funcDeclToApply.name);
                        }

                        let changed = false;
                        if (existingIndex !== -1) {
                            if (!areObjectsEffectivelyEqual(newDeclarations[existingIndex] as unknown as Record<string, unknown>, funcDeclToApply as unknown as Record<string, unknown>)) {
                                console.log(`Overwriting function declaration (ID: ${funcDeclToApply.id}, Name: ${funcDeclToApply.name}) from URL encoded param.`);
                                newDeclarations[existingIndex] = funcDeclToApply;
                                changed = true;
                            }
                        } else {
                            console.log(`Adding new function declaration (ID: ${funcDeclToApply.id}, Name: ${funcDeclToApply.name}) from URL encoded param.`);
                            newDeclarations.push(funcDeclToApply);
                            changed = true;
                        }
                        
                        if (changed) {
                            console.log("Function declarations updated by URL encoded param:", JSON.stringify(newDeclarations, null, 2));
                            return { ...prevSettings, functionDeclarations: newDeclarations };
                        }
                        console.log("Skipping function declaration update from URL, no effective changes needed.");
                        return prevSettings;
                    });
                }

            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error("Error during processAndApply:", msg, error);
                operationError = msg; 
            } finally {
                if (operationError) {
                    setConfigError(operationError); 
                }
                setIsLoadingConfig(false);
                // console.log("Finished processAndApply cycle for URL parameters.");
                // CRUCIAL: Mark this search string as processed, regardless of success or failure of the attempt.
                processedSearchStringRef.current = currentSearch;
            }
        };

        processAndApply();

    }, [window.location.search, setSettings, replaceAllMemories, appSettingsContext, memoryContext]); // React to URL changes and context availability/methods.

    return { isLoadingConfig, configError };
}
