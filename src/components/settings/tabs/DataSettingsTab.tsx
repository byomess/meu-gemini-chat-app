// src/components/settings/tabs/DataSettingsTab.tsx
import React, { useRef, useContext } from "react";
import { IoTrashOutline, IoArrowUpOutline, IoArrowDownOutline } from "react-icons/io5"; // Added IoArrowUpOutline, IoArrowDownOutline
import Button from "../../common/Button";
import { useMemories } from "../../../contexts/MemoryContext";
import { useConversations } from "../../../contexts/ConversationContext";
import { AppSettingsContext } from "../../../contexts/AppSettingsContext"; // Added AppSettingsContext
import type { AppSettings, Memory, FunctionDeclaration, GeminiModelConfig } from "../../../types"; // Added type imports
import { v4 as uuidv4 } from 'uuid'; // Added uuid

// Define the structure for the URL config file, mirroring useUrlConfigInitializer's UrlConfigFile
// This interface is defined here to ensure it's specific to the import/export functionality
// and can handle potential variations like 'showNavigation' from external files.
interface UrlConfigFile {
    apiKey?: string;
    geminiModelConfig?: Partial<GeminiModelConfig>;
    customPersonalityPrompt?: string;
    functionDeclarations?: FunctionDeclaration[];
    aiAvatarUrl?: string;
    memories?: {
        id?: string;
        content: string;
        timestamp: string; // ISO string
        sourceMessageId?: string;
    }[];
    codeSynthaxHighlightEnabled?: boolean;
    theme?: 'dark' | 'light';
    enableWebSearch?: boolean;
    enableAttachments?: boolean;
    hideNavigation?: boolean; // Matches AppSettings and useUrlConfigInitializer
    showNavigation?: boolean; // For compatibility with external files that might use this
}

const DataSettingsTab: React.FC = () => {
    const { clearAllMemories, memories, replaceAllMemories } = useMemories(); // Added replaceAllMemories
    const { deleteAllConversations, conversations } = useConversations();
    const importFileInputRef = useRef<HTMLInputElement>(null); // Added ref for file input
    const appSettingsContext = useContext(AppSettingsContext); // Added AppSettingsContext usage

    // Added null check for context
    if (!appSettingsContext) {
        console.error("AppSettingsContext not found in DataSettingsTab.");
        return null; 
    }
    const { settings, setSettings } = appSettingsContext; // Destructure settings and setSettings

    const handleLocalClearAllMemories = () => {
        if (
            window.confirm(
                "Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita."
            )
        ) {
            clearAllMemories();
        }
    };

    const handleLocalDeleteAllConversations = () => {
        if (
            window.confirm(
                "Tem certeza de que deseja apagar TODAS as conversas? Esta ação não pode ser desfeita e apagará todo o seu histórico."
            )
        ) {
            deleteAllConversations();
        }
    };

    // Added handleExportSettings function
    const handleExportSettings = () => {
        const exportData: UrlConfigFile = {
            apiKey: settings.apiKey,
            geminiModelConfig: settings.geminiModelConfig,
            customPersonalityPrompt: settings.customPersonalityPrompt,
            functionDeclarations: settings.functionDeclarations,
            aiAvatarUrl: settings.aiAvatarUrl,
            codeSynthaxHighlightEnabled: settings.codeSynthaxHighlightEnabled,
            theme: settings.theme,
            enableWebSearch: settings.enableWebSearch,
            enableAttachments: settings.enableAttachments,
            hideNavigation: settings.hideNavigation, // Exporting as hideNavigation
            memories: memories.map(mem => ({
                id: mem.id,
                content: mem.content,
                timestamp: mem.timestamp.toISOString(),
                sourceMessageId: mem.sourceMessageId,
            })),
        };

        const filename = `loox_settings_export_${new Date().toISOString().slice(0, 10)}.json`;
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Added handleImportSettingsClick function
    const handleImportSettingsClick = () => {
        importFileInputRef.current?.click();
    };

    // Added handleImportSettings function
    const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData: UrlConfigFile = JSON.parse(e.target?.result as string);

                // Apply AppSettings
                setSettings((prevSettings: AppSettings) => {
                    const newSettings: AppSettings = { ...prevSettings };
                    let changed = false;

                    if (importedData.apiKey !== undefined && newSettings.apiKey !== importedData.apiKey) {
                        newSettings.apiKey = importedData.apiKey;
                        changed = true;
                    }
                    if (importedData.geminiModelConfig !== undefined) {
                        const mergedConfig = { ...newSettings.geminiModelConfig, ...importedData.geminiModelConfig };
                        if (importedData.geminiModelConfig.safetySettings) {
                            mergedConfig.safetySettings = importedData.geminiModelConfig.safetySettings.map(ss => ({ ...ss }));
                        }
                        if (JSON.stringify(newSettings.geminiModelConfig) !== JSON.stringify(mergedConfig)) {
                            newSettings.geminiModelConfig = mergedConfig;
                            changed = true;
                        }
                    }
                    if (importedData.customPersonalityPrompt !== undefined && newSettings.customPersonalityPrompt !== importedData.customPersonalityPrompt) {
                        newSettings.customPersonalityPrompt = importedData.customPersonalityPrompt;
                        changed = true;
                    }
                    if (importedData.functionDeclarations !== undefined) {
                        const newDeclarations = importedData.functionDeclarations.map(fd => ({ ...fd, id: fd.id || uuidv4() }));
                        if (JSON.stringify(newSettings.functionDeclarations) !== JSON.stringify(newDeclarations)) {
                            newSettings.functionDeclarations = newDeclarations;
                            changed = true;
                        }
                    }
                    if (importedData.aiAvatarUrl !== undefined && newSettings.aiAvatarUrl !== importedData.aiAvatarUrl) {
                        newSettings.aiAvatarUrl = importedData.aiAvatarUrl;
                        changed = true;
                    }
                    if (importedData.codeSynthaxHighlightEnabled !== undefined && newSettings.codeSynthaxHighlightEnabled !== importedData.codeSynthaxHighlightEnabled) {
                        newSettings.codeSynthaxHighlightEnabled = importedData.codeSynthaxHighlightEnabled;
                        changed = true;
                    }
                    if (importedData.theme !== undefined && newSettings.theme !== importedData.theme) {
                        newSettings.theme = importedData.theme;
                        changed = true;
                    }
                    if (importedData.enableWebSearch !== undefined && newSettings.enableWebSearch !== importedData.enableWebSearch) {
                        newSettings.enableWebSearch = importedData.enableWebSearch;
                        changed = true;
                    }
                    if (importedData.enableAttachments !== undefined && newSettings.enableAttachments !== importedData.enableAttachments) {
                        newSettings.enableAttachments = importedData.enableAttachments;
                        changed = true;
                    }

                    let newHideNavigationValue: boolean | undefined;
                    if (importedData.hideNavigation !== undefined) {
                        newHideNavigationValue = importedData.hideNavigation;
                    } else if (importedData.showNavigation !== undefined) {
                        newHideNavigationValue = !importedData.showNavigation; 
                    }

                    if (newHideNavigationValue !== undefined && newSettings.hideNavigation !== newHideNavigationValue) {
                        newSettings.hideNavigation = newHideNavigationValue;
                        changed = true;
                    }

                    return changed ? newSettings : prevSettings;
                });

                if (importedData.memories) {
                    const parsedMemories: Memory[] = importedData.memories.map(mem => {
                        const timestampDate = new Date(mem.timestamp);
                        return {
                            id: mem.id || uuidv4(),
                            content: mem.content,
                            timestamp: isNaN(timestampDate.getTime()) ? new Date() : timestampDate,
                            sourceMessageId: mem.sourceMessageId,
                        };
                    });
                    replaceAllMemories(parsedMemories);
                }

                alert("Configurações importadas com sucesso!");
            } catch (error) {
                console.error("Erro ao importar configurações:", error);
                alert("Erro ao importar configurações. Verifique se o arquivo está no formato correto.");
            } finally {
                if (importFileInputRef.current) {
                    importFileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                    Gerenciamento de Dados
                </h3>
                <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4 shadow">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Apagar todas as memórias
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Remove todas as memórias armazenadas pela IA.
                            </p>
                        </div>
                        <Button
                            variant="danger"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-[180px]"
                            onClick={handleLocalClearAllMemories}
                            disabled={memories.length === 0}
                        >
                            {" "}
                            <IoTrashOutline className="mr-1.5" /> Limpar Memórias{" "}
                        </Button>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Apagar todas as conversas
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Remove todo o seu histórico de conversas.
                            </p>
                        </div>
                        <Button
                            variant="danger"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-[180px]"
                            onClick={handleLocalDeleteAllConversations}
                            disabled={conversations.length === 0}
                        >
                            {" "}
                            <IoTrashOutline className="mr-1.5" /> Limpar Conversas{" "}
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-4 text-center">
                    Todas as ações de exclusão de dados são irreversíveis.
                </p>
            </div>

            {/* New section for Import/Export */}
            <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                    Importar/Exportar Configurações
                </h3>
                <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4 shadow">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Exportar todas as configurações
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Salva todas as configurações e memórias em um arquivo JSON.
                            </p>
                        </div>
                        <Button
                            variant="secondary"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-[180px]"
                            onClick={handleExportSettings}
                        >
                            {" "}
                            <IoArrowUpOutline className="mr-1.5" /> Exportar{" "}
                        </Button>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Importar configurações
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Carrega configurações de um arquivo JSON.
                            </p>
                        </div>
                        <input
                            type="file"
                            accept=".json"
                            ref={importFileInputRef}
                            onChange={handleImportSettings}
                            className="hidden"
                        />
                        <Button
                            variant="secondary"
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-[180px]"
                            onClick={handleImportSettingsClick}
                        >
                            {" "}
                            <IoArrowDownOutline className="mr-1.5" /> Importar{" "}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataSettingsTab;
