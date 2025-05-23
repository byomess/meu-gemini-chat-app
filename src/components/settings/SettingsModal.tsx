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
import Button from "../common/Button";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import type {
    GeminiModelConfig,
    FunctionDeclaration as AppFunctionDeclaration,
    SafetySetting,
} from "../../types";
import {
    HarmBlockThreshold as GenaiHarmBlockThresholdEnum,
} from "@google/genai";
import { useDialog } from "../../contexts/DialogContext"; // Import useDialog

// Import new tab components
import GeneralSettingsTab, { DEFAULT_PERSONALITY_FOR_PLACEHOLDER } from "./tabs/GeneralSettingsTab";
import ModelSettingsTab, { AVAILABLE_GEMINI_MODELS, HARM_CATEGORIES_CONFIG, appDefaultSafetySettings } from "./tabs/ModelSettingsTab";
import MemoriesSettingsTab from "./tabs/MemoriesSettingsTab";
import FunctionCallingSettingsTab from "./tabs/FunctionCallingSettingsTab";
import InterfaceSettingsTab from "./tabs/InterfaceSettingsTab";
import DataSettingsTab from "./tabs/DataSettingsTab";

interface LocalFunctionDeclaration {
    id: string;
    name: string;
    description: string;
    parametersSchema: string;
    endpointUrl: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

type TabId = "general" | "model" | "memories" | "functionCalling" | "interface" | "data";

interface Tab {
    id: TabId;
    label: string;
    icon: React.ReactElement;
    component: React.FC<any>;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { settings, setSettings } = useAppSettings();
    const { showDialog, dialogProps } = useDialog(); // Use the dialog hook and get dialogProps
    const [currentApiKey, setCurrentApiKey] = useState<string>("");
    const [currentCustomPersonalityPrompt, setCurrentCustomPersonalityPrompt] =
        useState<string>(DEFAULT_PERSONALITY_FOR_PLACEHOLDER);
    const [currentFunctionDeclarations, setCurrentFunctionDeclarations] =
        useState<LocalFunctionDeclaration[]>([]);
    const [currentAiAvatarUrl, setCurrentAiAvatarUrl] = useState<string>("");
    const [isCodeHighlightEnabledState, setIsCodeHighlightEnabledState] =
        useState<boolean>(settings.codeSynthaxHighlightEnabled);
    const [currentEnableWebSearchEnabled, setCurrentEnableWebSearchEnabled] =
        useState<boolean>(settings.enableWebSearch);
    const [currentAttachmentsEnabled, setCurrentAttachmentsEnabled] =
        useState<boolean>(settings.enableAttachments);
    const [currentHideNavigation, setCurrentHideNavigation] =
        useState<boolean>(settings.hideNavigation);


    const [activeTab, setActiveTab] = useState<TabId>("general");
    const modalContentRef = useRef<HTMLDivElement>(null);
    const [previousTab, setPreviousTab] = useState<TabId | null>(null);

    const defaultModelConfigValues = useMemo((): GeminiModelConfig => {
        const defaultFirstModel =
            AVAILABLE_GEMINI_MODELS[0] || "gemini-2.5-flash-preview-04-17";
        return {
            model: defaultFirstModel,
            temperature: 0.9,
            topP: 0.95,
            topK: 0,
            maxOutputTokens: defaultFirstModel.includes("flash")
                ? 8192
                : defaultFirstModel.includes("pro")
                    ? defaultFirstModel.includes("preview")
                        ? 32768
                        : 8192
                    : 8192,
            safetySettings: appDefaultSafetySettings,
        };
    }, []);

    const [localModelConfig, setLocalModelConfig] = useState<GeminiModelConfig>(
        settings.geminiModelConfig || defaultModelConfigValues
    );

    useEffect(() => {
        if (isOpen) {
            setCurrentApiKey(settings.apiKey || "");
            setCurrentAiAvatarUrl(settings.aiAvatarUrl || "");
            setIsCodeHighlightEnabledState(settings.codeSynthaxHighlightEnabled);
            setCurrentEnableWebSearchEnabled(settings.enableWebSearch);
            setCurrentAttachmentsEnabled(settings.enableAttachments);
            setCurrentHideNavigation(settings.hideNavigation);


            const currentSettingsSafety = settings.geminiModelConfig?.safetySettings;
            let effectiveSafetySettings: SafetySetting[];

            if (
                currentSettingsSafety &&
                Array.isArray(currentSettingsSafety) &&
                currentSettingsSafety.length === HARM_CATEGORIES_CONFIG.length
            ) {
                const allCategoriesPresent = HARM_CATEGORIES_CONFIG.every((hc) =>
                    currentSettingsSafety.find((s) => s.category === hc.id && s.threshold)
                );
                if (allCategoriesPresent) {
                    effectiveSafetySettings = currentSettingsSafety;
                } else {
                    effectiveSafetySettings = appDefaultSafetySettings;
                }
            } else {
                effectiveSafetySettings = appDefaultSafetySettings;
            }

            const mergedModelConfig = {
                ...defaultModelConfigValues,
                ...(settings.geminiModelConfig || {}),
                safetySettings: effectiveSafetySettings,
            };
            setLocalModelConfig(mergedModelConfig);

            setCurrentCustomPersonalityPrompt(settings.customPersonalityPrompt || "");
            const loadedFuncDeclarations = (settings.functionDeclarations || []).map(
                (fd) => ({
                    id: fd.id,
                    name: fd.name,
                    description: fd.description,
                    parametersSchema: fd.parametersSchema,
                    endpointUrl: fd.endpointUrl || "",
                    httpMethod: fd.httpMethod || "GET",
                })
            );
            setCurrentFunctionDeclarations(loadedFuncDeclarations);
        }
    }, [isOpen, settings, defaultModelConfigValues]);

    useEffect(() => {
        if (isOpen) {
            setPreviousTab(null);
            setActiveTab("general");
        }
    }, [isOpen]);

    const handleTabChange = (newTabId: TabId) => {
        setPreviousTab(activeTab);
        setActiveTab(newTabId);
    };

    const handleLocalModelConfigChange = (
        field: keyof GeminiModelConfig | "safetySettings",
        value: unknown
    ) => {
        if (field === "safetySettings") {
            setLocalModelConfig((prev) => ({
                ...prev,
                safetySettings: value as SafetySetting[],
            }));
        } else {
            setLocalModelConfig((prev) => ({
                ...prev,
                [field as keyof GeminiModelConfig]: value,
            }));
        }
    };

    const handleToggleCodeHighlightForTab = () => {
        if (!isCodeHighlightEnabledState) {
            showDialog({
                title: "Confirm Action",
                message: "Habilitar o destaque de sintaxe para código pode impactar o desempenho do aplicativo, especialmente em conversas muito longas com múltiplos blocos de código. Deseja continuar?",
                type: "confirm",
                confirmText: "Continuar",
                cancelText: "Cancelar",
                onConfirm: () => {
                    setIsCodeHighlightEnabledState(true);
                },
            });
        } else {
            setIsCodeHighlightEnabledState(false);
        }
    };

    const handleToggleEnableWebSearchForTab = () => {
        setCurrentEnableWebSearchEnabled(prev => !prev);
    };

    const handleToggleAttachmentsEnabledForTab = () => {
        setCurrentAttachmentsEnabled(prev => !prev);
    };

    const handleToggleHideNavigationForTab = () => {
        setCurrentHideNavigation(prev => !prev);
    };


    const handleSaveAllSettings = () => {
        if (localModelConfig.temperature < 0 || localModelConfig.temperature > 2) {
            showDialog({ title: "Validation Error", message: "A temperatura deve estar entre 0.0 e 2.0.", type: "alert" });
            return;
        }
        if (localModelConfig.topP < 0 || localModelConfig.topP > 1) {
            showDialog({ title: "Validation Error", message: "Top P deve estar entre 0.0 e 1.0.", type: "alert" });
            return;
        }
        if (localModelConfig.topK < 0) {
            showDialog({ title: "Validation Error", message: "Top K não pode ser negativo.", type: "alert" });
            return;
        }
        if (localModelConfig.maxOutputTokens < 1) {
            showDialog({ title: "Validation Error", message: "Máximo de Tokens de Saída deve ser pelo menos 1.", type: "alert" });
            return;
        }

        const appFuncDeclarations: AppFunctionDeclaration[] =
            currentFunctionDeclarations.map((lfd) => ({
                id: lfd.id,
                name: lfd.name,
                description: lfd.description,
                parametersSchema: lfd.parametersSchema,
                endpointUrl: lfd.endpointUrl,
                httpMethod: lfd.httpMethod,
            }));

        const finalSafetySettings: SafetySetting[] = HARM_CATEGORIES_CONFIG.map(
            (hc) => {
                const foundSetting = localModelConfig.safetySettings?.find(
                    (s) => s.category === hc.id
                );
                return {
                    category: hc.id,
                    threshold:
                        foundSetting?.threshold || GenaiHarmBlockThresholdEnum.BLOCK_NONE,
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
        }));
        showDialog({ title: "Success", message: "Configurações salvas com sucesso!", type: "alert" });
        // onClose(); // Optionally close the modal after saving
    };

    const tabs: Tab[] = [
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
                className="relative z-[100]"
                // Conditionally disable onClose if CustomDialog is open
                onClose={dialogProps?.isOpen ? () => {} : onClose}
                initialFocus={modalContentRef}
            >
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
                                ref={modalContentRef}
                                className="bg-[var(--color-settings-modal-bg)] rounded-2xl shadow-2xl w-full max-w-3xl text-gray-800 relative h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden border border-[var(--color-settings-modal-border)] text-left transform transition-all"
                            >
                                <div className="flex items-center justify-between p-4 pr-12 sm:p-5 sm:pr-14 border-b border-[var(--color-settings-modal-header-border)] flex-shrink-0 relative bg-[var(--color-settings-modal-header-bg)]">
                                    <Dialog.Title
                                        as="h2"
                                        className="text-lg font-semibold text-[var(--color-settings-modal-title-text)]"
                                    >
                                        Configurações do Aplicativo
                                    </Dialog.Title>
                                    <Button
                                        onClick={onClose}
                                        className="!absolute top-1/2 -translate-y-1/2 right-3 !p-2 text-[var(--color-settings-modal-close-button-text)] hover:text-[var(--color-settings-modal-close-button-hover-text)] rounded-full hover:!bg-[var(--color-settings-modal-close-button-hover-bg)] z-10"
                                        variant="icon"
                                        aria-label="Fechar modal"
                                    >
                                        {" "}
                                        <IoClose size={24} />{" "}
                                    </Button>
                                </div>
                                <div className="flex flex-col md:flex-row flex-grow min-h-0">
                                    <nav className="w-full md:w-52 flex-shrink-0 flex md:flex-col bg-[var(--color-settings-tab-nav-bg)] p-2 md:p-3 space-x-1 md:space-x-0 md:space-y-1.5 border-b md:border-b-0 md:border-r border-[var(--color-settings-tab-nav-border)] overflow-x-auto md:overflow-x-hidden">
                                        {tabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => handleTabChange(tab.id)}
                                                className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group whitespace-nowrap flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-settings-tab-nav-bg)] ${activeTab === tab.id
                                                    ? "bg-[var(--color-settings-tab-item-active-bg)] text-[var(--color-settings-tab-item-active-text)] shadow-md scale-[1.02]"
                                                    : "text-[var(--color-settings-tab-item-text)] hover:bg-[var(--color-settings-tab-item-hover-bg)] hover:text-[var(--color-primary)] active:scale-[0.98]"
                                                    }`}
                                                style={{ flex: "0 0 auto" }}
                                            >
                                                {React.cloneElement(
                                                    tab.icon as React.ReactElement<any>,
                                                    {
                                                        className: `transition-transform duration-200 ${activeTab === tab.id
                                                            ? "text-[var(--color-white)]"
                                                            : "text-[var(--color-settings-tab-item-icon)] group-hover:text-[var(--color-primary)]"
                                                            }`,
                                                    }
                                                )}
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </nav>
                                    <div className="flex flex-col flex-grow min-h-0 bg-[var(--color-settings-content-bg)] relative overflow-hidden">
                                        <div className="flex-grow p-4 sm:p-5 md:p-6 overflow-y-auto">
                                            {tabs.map((tab) => {
                                                const TabComponent = tab.component;
                                                const isTabActive = activeTab === tab.id;
                                                let enterFromClass = "opacity-0";
                                                let leaveToClass = "opacity-0";
                                                if (slideDirection !== 0) {
                                                    enterFromClass +=
                                                        slideDirection > 0
                                                            ? " translate-x-20"
                                                            : " -translate-x-20";
                                                    leaveToClass +=
                                                        slideDirection > 0
                                                            ? " -translate-x-20"
                                                            : " translate-x-20";
                                                }
                                                return (
                                                    <Transition
                                                        key={tab.id}
                                                        show={isTabActive}
                                                        as={Fragment}
                                                        enter="transition-all ease-in-out duration-300 transform"
                                                        enterFrom={enterFromClass}
                                                        enterTo="opacity-100 translate-x-0"
                                                        leave="transition-all ease-in-out duration-300 transform absolute inset-0"
                                                        leaveFrom="opacity-100 translate-x-0"
                                                        leaveTo={leaveToClass}
                                                    >
                                                        <div
                                                            className={`w-full h-full ${isTabActive ? "" : "hidden"
                                                                }`}
                                                        >
                                                            <TabComponent
                                                                {...(tab.id === "general" && {
                                                                    currentApiKey,
                                                                    setCurrentApiKey,
                                                                    currentCustomPersonalityPrompt,
                                                                    setCurrentCustomPersonalityPrompt,
                                                                })}
                                                                {...(tab.id === "model" && {
                                                                    currentModelConfig: localModelConfig,
                                                                    onModelConfigChange:
                                                                        handleLocalModelConfigChange,
                                                                })}
                                                                {...(tab.id === "functionCalling" && {
                                                                    currentFunctionDeclarations,
                                                                    setCurrentFunctionDeclarations,
                                                                })}
                                                                {...(tab.id === "interface" && {
                                                                    currentCodeHighlightEnabled: isCodeHighlightEnabledState,
                                                                    onToggleCodeHighlight: handleToggleCodeHighlightForTab,
                                                                    currentAiAvatarUrl: currentAiAvatarUrl,
                                                                    onAiAvatarUrlChange: setCurrentAiAvatarUrl,
                                                                    currentEnableWebSearchEnabled: currentEnableWebSearchEnabled,
                                                                    onToggleEnableWebSearch: handleToggleEnableWebSearchForTab,
                                                                    currentAttachmentsEnabled: currentAttachmentsEnabled,
                                                                    onToggleAttachmentsEnabled: handleToggleAttachmentsEnabledForTab,
                                                                    currentHideNavigation: currentHideNavigation,
                                                                    onToggleHideNavigation: handleToggleHideNavigationForTab,
                                                                })}
                                                            />
                                                        </div>
                                                    </Transition>
                                                );
                                            })}
                                        </div>
                                        <div className="p-4 border-t border-[var(--color-settings-modal-header-border)] flex-shrink-0 bg-[var(--color-settings-modal-header-bg)] flex justify-end">
                                            <Button
                                                variant="primary"
                                                onClick={handleSaveAllSettings}
                                                className="!py-2.5 !px-5 !font-semibold shadow-md hover:shadow-lg transform active:scale-[0.98] transition-all"
                                            >
                                                <IoCheckmarkCircleOutline size={18} className="mr-1.5" />{" "}
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
