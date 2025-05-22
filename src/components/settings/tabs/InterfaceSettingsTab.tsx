// src/components/settings/tabs/InterfaceSettingsTab.tsx
import React from "react";
import { Switch } from "@headlessui/react";
import { IoAvatarImageOutline } from "react-icons/io5";

interface InterfaceSettingsTabProps {
    currentCodeHighlightEnabled: boolean;
    onToggleCodeHighlight: () => void;
    currentAiAvatarUrl: string;
    onAiAvatarUrlChange: (url: string) => void;
    currentEnableWebSearchEnabled: boolean;
    onToggleEnableWebSearch: () => void;
    currentAttachmentsEnabled: boolean;
    onToggleAttachmentsEnabled: () => void;
    currentHideNavigation: boolean;
    onToggleHideNavigation: () => void;
}

const InterfaceSettingsTab: React.FC<InterfaceSettingsTabProps> = ({
    currentCodeHighlightEnabled,
    onToggleCodeHighlight,
    currentAiAvatarUrl,
    onAiAvatarUrlChange,
    currentEnableWebSearchEnabled,
    onToggleEnableWebSearch,
    currentAttachmentsEnabled,
    onToggleAttachmentsEnabled,
    currentHideNavigation,
    onToggleHideNavigation,
}) => {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                    Configurações de Interface
                </h3>
                <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4 shadow">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Habilitar destaque de sintaxe para código
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Ativa o destaque de sintaxe para blocos de código.
                            </p>
                        </div>
                        <Switch
                            checked={currentCodeHighlightEnabled}
                            onChange={onToggleCodeHighlight}
                            className={`${currentCodeHighlightEnabled ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentCodeHighlightEnabled ? "translate-x-[20px]" : "translate-x-0"
                                    } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div>
                        <label
                            htmlFor="aiAvatarUrl"
                            className="block text-sm font-medium text-gray-700 mb-1.5"
                        >
                            URL da Imagem do Avatar da IA
                        </label>
                        <div className="flex items-center gap-2">
                            <IoAvatarImageOutline className="text-gray-500 flex-shrink-0" size={20} />
                            <input
                                type="url"
                                id="aiAvatarUrl"
                                name="aiAvatarUrl"
                                placeholder="https://exemplo.com/avatar.png (deixe em branco para padrão)"
                                value={currentAiAvatarUrl}
                                onChange={(e) => onAiAvatarUrlChange(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 shadow-sm transition-colors"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Forneça uma URL para uma imagem de avatar personalizada para a IA. Se
                            deixado em branco, o ícone padrão será usado.
                        </p>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Habilitar botão de busca na web
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Mostra/oculta o botão para ativar a busca na web para a próxima mensagem.
                            </p>
                        </div>
                        <Switch
                            checked={currentEnableWebSearchEnabled}
                            onChange={onToggleEnableWebSearch}
                            className={`${currentEnableWebSearchEnabled ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentEnableWebSearchEnabled ? "translate-x-[20px]" : "translate-x-0"
                                    } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Habilitar anexos de arquivos
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Mostra/oculta o botão para anexar arquivos às mensagens.
                            </p>
                        </div>
                        <Switch
                            checked={currentAttachmentsEnabled}
                            onChange={onToggleAttachmentsEnabled}
                            className={`${currentAttachmentsEnabled ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentAttachmentsEnabled ? "translate-x-[20px]" : "translate-x-0"
                                    } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Ocultar Navegação Principal
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Oculta a barra lateral de navegação e o botão de menu em dispositivos móveis.
                            </p>
                        </div>
                        <Switch
                            checked={currentHideNavigation}
                            onChange={onToggleHideNavigation}
                            className={`${currentHideNavigation ? "bg-[#e04579]" : "bg-gray-300"
                                } relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75`}
                        >
                            <span
                                aria-hidden="true"
                                className={`${currentHideNavigation ? "translate-x-[20px]" : "translate-x-0"
                                    } pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                        </Switch>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InterfaceSettingsTab;
