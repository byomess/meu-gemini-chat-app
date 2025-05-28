// src/components/settings/SettingsModal.tsx
import React, { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
    IoClose,
    IoKeyOutline,
    IoBuildOutline,
    IoTerminalOutline,
    IoColorPaletteOutline,
    IoCheckmarkCircleOutline
} from "react-icons/io5";
import { FiDatabase } from "react-icons/fi";
import { LuBrain } from "react-icons/lu";
import Button from "../common/Button"; // Ajuste o caminho se necessário
import { useAppSettings } from "../../contexts/AppSettingsContext"; // Ajuste o caminho se necessário
import type {
    GeminiModelConfig,
    FunctionDeclaration as AppFunctionDeclaration,
    SafetySetting,
    MemoriesSettingsTabProps, // Supondo que este tipo seja usado por MemoriesSettingsTab
    ThemeName // ADDED: Import ThemeName
} from "../../types"; // Ajuste o caminho se necessário
import {
    HarmBlockThreshold as GenaiHarmBlockThresholdEnum,
} from "@google/genai";
import { useDialog } from "../../contexts/DialogContext"; // Ajuste o caminho se necessário

import GeneralSettingsTab from "./tabs/GeneralSettingsTab"; // Ajuste o caminho se necessário
import type { GeneralSettingsTabProps } from "./tabs/GeneralSettingsTab"; // Ajuste o caminho se necessário
import ModelSettingsTab, {
    HARM_CATEGORIES_CONFIG, // Exportado de ModelSettingsTab
    appDefaultSafetySettings, // Exportado de ModelSettingsTab
    AVAILABLE_GEMINI_MODELS // Exportado de ModelSettingsTab
} from "./tabs/ModelSettingsTab"; // Ajuste o caminho se necessário
import type { ModelSettingsTabProps } from "./tabs/ModelSettingsTab"; // Ajuste o caminho se necessário
import MemoriesSettingsTab from "./tabs/MemoriesSettingsTab"; // Ajuste o caminho se necessário
import FunctionCallingSettingsTab from "./tabs/FunctionCallingSettingsTab"; // Ajuste o caminho se necessário
import type { FunctionCallingSettingsTabProps } from "./tabs/FunctionCallingSettingsTab"; // Ajuste o caminho se necessário
import InterfaceSettingsTab from "./tabs/InterfaceSettingsTab"; // Ajuste o caminho se necessário
import type { InterfaceSettingsTabProps } from "./tabs/InterfaceSettingsTab"; // Ajuste o caminho se necessário
import DataSettingsTab from "./tabs/DataSettingsTab"; // Ajuste o caminho se necessário
import type { DataSettingsTabProps } from "./tabs/DataSettingsTab"; // Ajuste o caminho se necessário

type TabId = "general" | "model" | "memories" | "functionCalling" | "interface" | "data";

interface BaseTabConfig {
    id: TabId;
    label: string;
    icon: React.ReactElement;
}

// Definindo tipos mais específicos para cada configuração de aba se necessário
interface GeneralTabConfig extends BaseTabConfig {
    id: "general";
    component: React.FC<GeneralSettingsTabProps>;
}

interface ModelTabConfig extends BaseTabConfig {
    id: "model";
    component: React.FC<ModelSettingsTabProps>;
}

interface MemoriesTabConfig extends BaseTabConfig {
    id: "memories";
    component: React.FC<MemoriesSettingsTabProps>;
}

interface FunctionCallingTabConfig extends BaseTabConfig {
    id: "functionCalling";
    component: React.FC<FunctionCallingSettingsTabProps>;
}

interface InterfaceTabConfig extends BaseTabConfig {
    id: "interface";
    component: React.FC<InterfaceSettingsTabProps>;
}

interface DataTabConfig extends BaseTabConfig {
    id: "data";
    component: React.FC<DataSettingsTabProps>;
}

type TabConfig = GeneralTabConfig | ModelTabConfig | MemoriesTabConfig | FunctionCallingTabConfig | InterfaceTabConfig | DataTabConfig;

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    syncDriveData: () => Promise<void>; // ADDED: syncDriveData prop
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, syncDriveData }) => { // MODIFIED: Destructured syncDriveData
    const { settings, setSettings } = useAppSettings();
    const { showDialog, isDialogActive } = useDialog();

    // Initialize activeTab to "general"
    const [activeTab, setActiveTab] = useState<TabId>("general");
    const modalContentRef = useRef<HTMLDivElement>(null);
    const [previousTab, setPreviousTab] = useState<TabId | null>(null);

    // State for local settings (these are synced from global settings when modal opens)
    const [currentApiKey, setCurrentApiKey] = useState<string>("");
    const [currentCustomPersonalityPrompt, setCurrentCustomPersonalityPrompt] =
        useState<string>("");
    const [currentFunctionDeclarations, setCurrentFunctionDeclarations] =
        useState<AppFunctionDeclaration[]>([]);
    const [currentAiAvatarUrl, setCurrentAiAvatarUrl] = useState<string>("");
    const [isCodeHighlightEnabledState, setIsCodeHighlightEnabledState] =
        useState<boolean>(settings.codeSynthaxHighlightEnabled);
    const [currentEnableWebSearchEnabled, setCurrentEnableWebSearchEnabled] =
        useState<boolean>(settings.enableWebSearch);
    const [currentAttachmentsEnabled, setCurrentAttachmentsEnabled] =
        useState<boolean>(settings.enableAttachments);
    const [currentHideNavigation, setCurrentHideNavigation] =
        useState<boolean>(settings.hideNavigation);
    const [currentShowProcessingIndicatorsState, setCurrentShowProcessingIndicatorsState] =
        useState<boolean>(settings.showProcessingIndicators);
    const [currentShowAiFunctionCallAttachments, setCurrentShowAiFunctionCallAttachments] = // ADDED: New state for AI function call attachments
        useState<boolean>(settings.showAiFunctionCallAttachments);
    const [currentTheme, setCurrentTheme] = useState<ThemeName>(settings.theme); // ADDED: New state for theme

    const defaultModelConfigValues: GeminiModelConfig = useMemo(() => {
        const defaultFirstModel =
            AVAILABLE_GEMINI_MODELS[0] || "gemini-1.5-flash-latest";
        return {
            model: defaultFirstModel,
            temperature: 0.9,
            topP: 0.95,
            topK: 0,
            maxOutputTokens: defaultFirstModel.includes("flash")
                ? 8192
                : defaultFirstModel.includes("pro")
                    ? 8192
                    : 8192,
            safetySettings: appDefaultSafetySettings,
        };
    }, []);

    const [localModelConfig, setLocalModelConfig] = useState<GeminiModelConfig>(
        settings.geminiModelConfig || defaultModelConfigValues
    );

    // Effect to reset tab to "general" when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab("general");
            setPreviousTab(null); // Also reset previous tab
        }
    }, [isOpen]); // Only depends on isOpen

    // Effect to sync local states with global settings when modal opens or global settings change
    useEffect(() => {
        if (isOpen) {
            // Sincroniza estados locais com as configurações globais ao abrir
            setCurrentApiKey(settings.apiKey || "");
            setCurrentAiAvatarUrl(settings.aiAvatarUrl || "");
            setIsCodeHighlightEnabledState(settings.codeSynthaxHighlightEnabled);
            setCurrentEnableWebSearchEnabled(settings.enableWebSearch);
            setCurrentAttachmentsEnabled(settings.enableAttachments);
            setCurrentHideNavigation(settings.hideNavigation);
            setCurrentShowProcessingIndicatorsState(settings.showProcessingIndicators);
            setCurrentShowAiFunctionCallAttachments(settings.showAiFunctionCallAttachments); // ADDED: Sync new setting
            setCurrentCustomPersonalityPrompt(settings.customPersonalityPrompt || "");
            setCurrentTheme(settings.theme); // ADDED: Sync theme

            const currentSettingsSafety = settings.geminiModelConfig?.safetySettings;
            let effectiveSafetySettings: SafetySetting[];

            if (
                currentSettingsSafety &&
                Array.isArray(currentSettingsSafety) &&
                currentSettingsSafety.length === HARM_CATEGORIES_CONFIG.length &&
                HARM_CATEGORIES_CONFIG.every((hc) =>
                    currentSettingsSafety.find((s) => s.category === hc.id && typeof s.threshold === 'string')
                )
            ) {
                effectiveSafetySettings = currentSettingsSafety;
            } else {
                // Se inválido ou incompleto, recalcula baseado em appDefaultSafetySettings
                effectiveSafetySettings = HARM_CATEGORIES_CONFIG.map(hc_config => {
                    const defaultSetting = appDefaultSafetySettings.find(s => s.category === hc_config.id);
                    return {
                        category: hc_config.id,
                        threshold: defaultSetting ? defaultSetting.threshold : GenaiHarmBlockThresholdEnum.BLOCK_NONE
                    };
                });
            }

            const mergedModelConfig: GeminiModelConfig = {
                ...defaultModelConfigValues, // Começa com os defaults do app
                ...(settings.geminiModelConfig || {}), // Sobrescreve com as configurações salvas
                safetySettings: effectiveSafetySettings, // Garante que safetySettings está correto
            };
            setLocalModelConfig(mergedModelConfig);

            const loadedFuncDeclarations: AppFunctionDeclaration[] = (settings.functionDeclarations || []).map(
                (fd) => ({
                    id: fd.id || crypto.randomUUID(), // Garante ID se ausente
                    name: fd.name || "",
                    description: fd.description || "",
                    parametersSchema: typeof fd.parametersSchema === "string"
                        ? fd.parametersSchema
                        : JSON.stringify(fd.parametersSchema || { type: "object", properties: {}, required: [] }),
                    endpointUrl: fd.endpointUrl || "",
                    httpMethod: fd.httpMethod || "POST",
                    type: fd.type || (fd.code ? 'javascript' : 'api'), // ADDED: Ensure type property
                })
            );
            setCurrentFunctionDeclarations(loadedFuncDeclarations);
        }
    }, [isOpen, settings, defaultModelConfigValues]); // This effect should only sync data, not control active tab

    const handleTabChange = (newTabId: TabId) => {
        setPreviousTab(activeTab);
        setActiveTab(newTabId);
    };

    const handleToggleCodeHighlightForTab = () => {
        if (!isCodeHighlightEnabledState) { // Se for desabilitar
            showDialog({
                title: "Confirmar Ação",
                message: "Habilitar o destaque de sintaxe para código pode impactar o desempenho do aplicativo, especialmente em conversas muito longas com múltiplos blocos de código. Deseja continuar?",
                type: "confirm",
                confirmText: "Continuar",
                cancelText: "Cancelar",
                onConfirm: () => {
                    setIsCodeHighlightEnabledState(true);
                },
                // onAfterClose pode ser usado se precisar de alguma ação após o dialog fechar
            });
        } else {
            setIsCodeHighlightEnabledState(false);
        }
    };

    const handleToggleEnableWebSearchForTab = () => {
        setCurrentEnableWebSearchEnabled((prev) => !prev);
    };

    const handleToggleAttachmentsEnabledForTab = () => {
        setCurrentAttachmentsEnabled((prev) => !prev);
    };

    const handleToggleHideNavigationForTab = () => {
        setCurrentHideNavigation((prev) => !prev);
    };

    const handleToggleShowProcessingIndicatorsForTab = () => { // Add new handler
        setCurrentShowProcessingIndicatorsState((prev) => !prev);
    };

    const handleToggleShowAiFunctionCallAttachmentsForTab = () => { // ADDED: New handler for AI function call attachments
        setCurrentShowAiFunctionCallAttachments((prev) => !prev);
    };

    const handleSaveAllSettings = () => {
        // Validações
        if (localModelConfig.temperature < 0 || localModelConfig.temperature > 2) {
            showDialog({ title: "Erro de Validação", message: "A temperatura deve estar entre 0.0 e 2.0.", type: "alert" });
            return;
        }
        if (localModelConfig.topP < 0 || localModelConfig.topP > 1) {
            showDialog({ title: "Erro de Validação", message: "Top P deve estar entre 0.0 e 1.0.", type: "alert" });
            return;
        }
        if (localModelConfig.topK < 0) { // Top K geralmente não é negativo, mas 0 é um valor válido (significa não usar topK)
            showDialog({ title: "Erro de Validação", message: "Top K não pode ser negativo.", type: "alert" });
            return;
        }
        if (localModelConfig.maxOutputTokens < 1) {
            showDialog({ title: "Erro de Validação", message: "Máximo de Tokens de Saída deve ser pelo menos 1.", type: "alert" });
            return;
        }

        // Prepara declarações de função para salvar
        const appFuncDeclarations: AppFunctionDeclaration[] =
            currentFunctionDeclarations.map((lfd) => ({
                id: lfd.id,
                name: lfd.name,
                description: lfd.description,
                parametersSchema: lfd.parametersSchema, // Assegure-se que este é um objeto JSON válido
                endpointUrl: lfd.endpointUrl,
                httpMethod: lfd.httpMethod,
                type: lfd.type, // ADDED: Pass through the type property
            }));

        // Garante que todas as categorias de segurança estão presentes
        const finalSafetySettings: SafetySetting[] = HARM_CATEGORIES_CONFIG.map(
            (hc) => {
                const foundSetting = localModelConfig.safetySettings?.find(
                    (s) => s.category === hc.id
                );
                return {
                    category: hc.id,
                    threshold:
                        foundSetting?.threshold || GenaiHarmBlockThresholdEnum.BLOCK_NONE, // Default se não encontrado
                };
            }
        );

        const newGeminiConfig: GeminiModelConfig = {
            ...localModelConfig,
            safetySettings: finalSafetySettings,
        };

        setSettings((prevSettings) => ({
            ...prevSettings,
            apiKey: currentApiKey,
            geminiModelConfig: newGeminiConfig,
            customPersonalityPrompt: currentCustomPersonalityPrompt.trim(),
            functionDeclarations: appFuncDeclarations,
            aiAvatarUrl: currentAiAvatarUrl.trim(),
            codeSynthaxHighlightEnabled: isCodeHighlightEnabledState,
            enableWebSearch: currentEnableWebSearchEnabled,
            enableAttachments: currentAttachmentsEnabled,
            hideNavigation: currentHideNavigation,
            showProcessingIndicators: currentShowProcessingIndicatorsState, // Save new setting
            showAiFunctionCallAttachments: currentShowAiFunctionCallAttachments, // ADDED: Save new setting
            theme: currentTheme, // ADDED: Save the selected theme
        }));
        showDialog({ title: "Sucesso", message: "Configurações salvas com sucesso!", type: "alert" });
        // onClose(); // Opcional: fechar o modal de configurações após salvar
    };

    const tabs: TabConfig[] = [
        {
            id: "general",
            label: "Geral",
            icon: <IoKeyOutline size={18} className="opacity-80" />,
            component: GeneralSettingsTab,
        },
        {
            id: "model",
            label: "Modelo IA",
            icon: <IoBuildOutline size={18} className="opacity-80" />,
            component: ModelSettingsTab,
        },
        {
            id: "memories",
            label: "Memórias",
            icon: <LuBrain size={18} className="opacity-80" />,
            component: MemoriesSettingsTab,
        },
        {
            id: "functionCalling",
            label: "Funções (API)",
            icon: <IoTerminalOutline size={18} className="opacity-80" />,
            component: FunctionCallingSettingsTab,
        },
        {
            id: "interface",
            label: "Interface",
            icon: <IoColorPaletteOutline size={18} className="opacity-80" />,
            component: InterfaceSettingsTab,
        },
        {
            id: "data",
            label: "Dados",
            icon: <FiDatabase size={17} className="opacity-80" />,
            component: DataSettingsTab,
        },
    ];

    const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const previousTabIndex = previousTab
        ? tabs.findIndex((tab) => tab.id === previousTab)
        : -1;
    const slideDirection =
        previousTabIndex === -1 || activeTabIndex === previousTabIndex
            ? 0
            : activeTabIndex > previousTabIndex
                ? 1
                : -1;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-[100]" // z-index para o modal de configurações
                onClose={isDialogActive ? () => { } : onClose} // CORRIGIDO: usa isDialogActive
                initialFocus={modalContentRef} // Foca no conteúdo do modal ao abrir
            >
                {/* Overlay */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-[var(--color-settings-modal-overlay-bg)] backdrop-blur-sm" />
                </Transition.Child>

                {/* Conteúdo do Modal */}
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translate-y-8 sm:translate-y-4"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-8 sm:translate-y-4"
                        >
                            <Dialog.Panel
                                ref={modalContentRef} // Ref para o initialFocus
                                className="bg-[var(--color-settings-modal-bg)] rounded-xl shadow-2xl w-full max-w-3xl text-[var(--color-text-primary)] relative h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden border border-[var(--color-settings-modal-border)] text-left transform transition-all"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 pr-12 sm:p-5 sm:pr-14 border-b border-[var(--color-settings-modal-header-border)] flex-shrink-0 relative bg-[var(--color-settings-modal-header-bg)]">
                                    <Dialog.Title
                                        as="h2"
                                        className="text-lg font-semibold text-[var(--color-settings-modal-title-text)]"
                                    >
                                        Configurações do Aplicativo
                                    </Dialog.Title>
                                    <Button
                                        onClick={onClose} // Botão para fechar o SettingsModal
                                        className="!absolute top-1/2 -translate-y-1/2 right-3 !p-2 text-[var(--color-settings-modal-close-button-text)] hover:text-[var(--color-settings-modal-close-button-hover-text)] rounded-full hover:!bg-[var(--color-settings-modal-close-button-hover-bg)] z-10"
                                        variant="icon"
                                        aria-label="Fechar modal"
                                    >
                                        <IoClose size={24} />
                                    </Button>
                                </div>

                                {/* Corpo Principal com Abas e Conteúdo */}
                                <div className="flex flex-col md:flex-row flex-grow min-h-0">
                                    {/* Navegação das Abas */}
                                    <nav className="w-full md:w-52 flex-shrink-0 flex md:flex-col bg-[var(--color-settings-tab-nav-bg)] p-2 md:p-3 space-x-1 md:space-x-0 md:space-y-1.5 border-b md:border-b-0 md:border-r border-[var(--color-settings-tab-nav-border)] overflow-x-auto md:overflow-x-hidden scrollbar-thin scrollbar-thumb-[var(--color-scrollbar-thumb)] scrollbar-track-[var(--color-scrollbar-track)]">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => handleTabChange(tab.id)}
                                                className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group whitespace-nowrap flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-settings-tab-nav-bg)] ${activeTab === tab.id
                                                    ? "bg-[var(--color-settings-tab-item-active-bg)] text-[var(--color-settings-tab-item-active-text)] shadow-md"
                                                    : "text-[var(--color-settings-tab-item-text)] hover:bg-[var(--color-settings-tab-item-hover-bg)] hover:text-[var(--color-primary)] active:scale-[0.98]"
                                                    }`}
                                                style={{ flex: "0 0 auto" }}
                                            >
                                                {React.cloneElement(
                                                    tab.icon as React.ReactElement<{ className?: string }>,
                                                    {
                                                        className: `transition-colors duration-150 ${activeTab === tab.id
                                                            ? "text-[var(--color-settings-tab-item-active-text)]"
                                                            : "text-[var(--color-settings-tab-item-icon)] group-hover:text-[var(--color-primary)]"
                                                            }`,
                                                    }
                                                )}
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </nav>

                                    {/* Conteúdo da Aba Ativa */}
                                    <div className="flex flex-col flex-grow min-h-0 bg-[var(--color-settings-content-bg)] relative overflow-hidden">
                                        <div className="flex-grow p-4 sm:p-5 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-scrollbar-thumb)] scrollbar-track-[var(--color-scrollbar-track)]">
                                            {tabs.map((tab) => {
                                                const isTabActive = activeTab === tab.id;
                                                let enterFromClass = "opacity-0";
                                                let leaveToClass = "opacity-0";

                                                if (slideDirection !== 0) {
                                                    enterFromClass +=
                                                        slideDirection > 0
                                                            ? " translate-x-12 sm:translate-x-16 md:translate-x-20"
                                                            : " -translate-x-12 sm:-translate-x-16 md:-translate-x-20";
                                                    leaveToClass +=
                                                        slideDirection > 0
                                                            ? " -translate-x-12 sm:-translate-x-16 md:-translate-x-20" // FIXED: Removed semicolon
                                                            : " translate-x-12 sm:translate-x-16 md:-translate-x-20"; // FIXED: Removed semicolon
                                                }

                                                return (
                                                    <Transition
                                                        key={tab.id}
                                                        show={isTabActive}
                                                        as={Fragment}
                                                        enter="transition-all ease-out duration-300 transform"
                                                        enterFrom={enterFromClass}
                                                        enterTo="opacity-100 translate-x-0"
                                                        leave="transition-all ease-in duration-200 transform"
                                                        leaveFrom="opacity-100 translate-x-0"
                                                        leaveTo={leaveToClass}
                                                    >
                                                        <div
                                                            className={`w-full h-full`}
                                                            role="tabpanel"
                                                            aria-labelledby={`tab-${tab.id}`}
                                                            hidden={!isTabActive}
                                                        >
                                                            {isTabActive && (
                                                                <>
                                                                    {tab.id === "general" && (
                                                                        <GeneralSettingsTab
                                                                            currentApiKey={currentApiKey}
                                                                            setCurrentApiKey={setCurrentApiKey}
                                                                            currentCustomPersonalityPrompt={currentCustomPersonalityPrompt}
                                                                            setCurrentCustomPersonalityPrompt={setCurrentCustomPersonalityPrompt}
                                                                        />
                                                                    )}
                                                                    {tab.id === "model" && (
                                                                        <ModelSettingsTab
                                                                            currentGeminiModelConfig={localModelConfig}
                                                                            setCurrentGeminiModelConfig={setLocalModelConfig}
                                                                                                                                                      />
                                                                    )}
                                                                    {tab.id === "functionCalling" && (
                                                                        <FunctionCallingSettingsTab
                                                                            currentFunctionDeclarations={currentFunctionDeclarations}
                                                                            setCurrentFunctionDeclarations={setCurrentFunctionDeclarations}
                                                                        />
                                                                    )}
                                                                    {tab.id === "interface" && (
                                                                        <InterfaceSettingsTab
                                                                            currentCodeHighlightEnabled={isCodeHighlightEnabledState}
                                                                            onToggleCodeHighlight={handleToggleCodeHighlightForTab}
                                                                            currentAiAvatarUrl={currentAiAvatarUrl}
                                                                            onAiAvatarUrlChange={setCurrentAiAvatarUrl}
                                                                            currentEnableWebSearchEnabled={currentEnableWebSearchEnabled}
                                                                            onToggleEnableWebSearch={handleToggleEnableWebSearchForTab}
                                                                            currentAttachmentsEnabled={currentAttachmentsEnabled}
                                                                            onToggleAttachmentsEnabled={handleToggleAttachmentsEnabledForTab}
                                                                            currentHideNavigation={currentHideNavigation}
                                                                            onToggleHideNavigation={handleToggleHideNavigationForTab}
                                                                            currentShowProcessingIndicators={currentShowProcessingIndicatorsState}
                                                                            onToggleShowProcessingIndicators={handleToggleShowProcessingIndicatorsForTab}
                                                                            currentShowAiFunctionCallAttachments={currentShowAiFunctionCallAttachments} // UPDATED: Pass new state
                                                                            onToggleShowAiFunctionCallAttachments={handleToggleShowAiFunctionCallAttachmentsForTab} // UPDATED: Pass new handler
                                                                            currentTheme={currentTheme} // ADDED: Pass theme state
                                                                            onThemeChange={setCurrentTheme} // ADDED: Pass theme setter
                                                                        />
                                                                    )}
                                                                    {tab.id === "memories" && (
                                                                        <MemoriesSettingsTab />
                                                                    )}
                                                                    {tab.id === "data" && (
                                                                        <DataSettingsTab
                                                                            syncDriveData={syncDriveData} // PASSED syncDriveData
                                                                        />
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </Transition>
                                                );
                                            })}
                                        </div>
                                        {/* Footer com Botão de Salvar */}
                                        <div className="p-4 border-t border-[var(--color-settings-modal-header-border)] flex-shrink-0 bg-[var(--color-settings-modal-header-bg)] flex justify-end">
                                            <Button
                                                variant="primary"
                                                onClick={handleSaveAllSettings}
                                                className="!py-2.5 !px-5 !font-semibold shadow-md hover:shadow-lg transform active:scale-[0.98] transition-all"
                                            >
                                                <IoCheckmarkCircleOutline size={18} className="mr-1.5" />
                                                Salvar Configurações
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default SettingsModal;
