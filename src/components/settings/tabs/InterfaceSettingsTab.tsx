// src/components/settings/tabs/InterfaceSettingsTab.tsx
import React from 'react';
import TextInput from '../../common/TextInput';
import { IoSparklesOutline } from 'react-icons/io5';
import SettingsPanel from '../SettingsPanel'; // Import the new SettingsPanel
import ToggleSwitch from '../../common/ToggleSwitch'; // Import the new ToggleSwitch component

export interface InterfaceSettingsTabProps {
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
    currentShowProcessingIndicators: boolean;
    onToggleShowProcessingIndicators: () => void;
    currentShowAiFunctionCallAttachments: boolean; // New prop
    onToggleShowAiFunctionCallAttachments: () => void; // New prop
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
    currentShowProcessingIndicators,
    onToggleShowProcessingIndicators,
    currentShowAiFunctionCallAttachments, // Destructure new prop
    onToggleShowAiFunctionCallAttachments, // Destructure new prop
}) => {
    return (
        <div className="space-y-6">
            <SettingsPanel
                title="Configurações de Interface"
                description="Personalize a aparência e o comportamento da interface do usuário."
            >
                <section className="space-y-5">
                    {/* AI Avatar URL */}
                    <div>
                        <TextInput
                            id="ai-avatar-url"
                            name="aiAvatarUrl"
                            label="URL do Avatar da IA"
                            value={currentAiAvatarUrl}
                            onChange={onAiAvatarUrlChange}
                            type="url"
                            placeholder="Ex: https://example.com/ai-avatar.png"
                            helperText="Defina uma URL para uma imagem de avatar personalizada para a IA. Deixe em branco para o avatar padrão."
                        />
                        <div className="mt-3 flex items-center space-x-3">
                            <span className="text-sm text-[var(--color-settings-section-description-text)]">Pré-visualização:</span>
                            {currentAiAvatarUrl ? (
                                <img
                                    src={currentAiAvatarUrl}
                                    alt="AI Avatar Preview"
                                    className="w-10 h-10 rounded-full object-cover border border-[var(--color-interface-settings-avatar-preview-border)] shadow-sm"
                                    style={{ objectFit: 'cover' }}
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { // Explicitly type the event
                                        e.currentTarget.className = "w-10 h-10 rounded-full object-cover border border-[var(--color-interface-settings-avatar-preview-border)] shadow-sm p-2 text-[var(--color-interface-settings-avatar-preview-text)] bg-[var(--color-interface-settings-avatar-preview-bg)]";
                                    }}
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--color-default-ai-avatar-gradient-from)] to-[var(--color-default-ai-avatar-gradient-to)] flex items-center justify-center text-white shadow-sm">
                                    <IoSparklesOutline size={20} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Code Syntax Highlight Toggle */}
                    <ToggleSwitch
                        id="code-highlight-toggle"
                        label="Realce de Sintaxe de Código"
                        description="Ativa ou desativa o realce de sintaxe para blocos de código nas respostas da IA."
                        checked={currentCodeHighlightEnabled}
                        onChange={onToggleCodeHighlight}
                    />

                    {/* Web Search Toggle */}
                    <ToggleSwitch
                        id="web-search-toggle"
                        label="Habilitar Pesquisa Web"
                        description="Permite que a IA acesse a internet para obter informações atualizadas."
                        checked={currentEnableWebSearchEnabled}
                        onChange={onToggleEnableWebSearch}
                    />

                    {/* Attachments Toggle */}
                    <ToggleSwitch
                        id="attachments-toggle"
                        label="Habilitar Anexos"
                        description="Permite enviar imagens e áudios para a IA."
                        checked={currentAttachmentsEnabled}
                        onChange={onToggleAttachmentsEnabled}
                    />

                    {/* Hide Navigation Toggle */}
                    <ToggleSwitch
                        id="hide-navigation-toggle"
                        label="Esconder Navegação"
                        description="Oculta a barra lateral de navegação por padrão."
                        checked={currentHideNavigation}
                        onChange={onToggleHideNavigation}
                    />

                    {/* Show Processing Indicators Toggle */}
                    <ToggleSwitch
                        id="show-indicators-toggle"
                        label="Exibir Indicadores de Status"
                        description="Controla a visibilidade dos indicadores de processamento de arquivos e chamadas de função nas mensagens da IA."
                        checked={currentShowProcessingIndicators}
                        onChange={onToggleShowProcessingIndicators}
                    />

                    {/* Show AI Function Call Attachments Toggle - NEW */}
                    <ToggleSwitch
                        id="show-ai-attachments-toggle"
                        label="Exibir Anexos de Chamadas de Função da IA"
                        description="Controla se os anexos gerados ou processados pela IA através de chamadas de função são exibidos nas mensagens."
                        checked={currentShowAiFunctionCallAttachments}
                        onChange={onToggleShowAiFunctionCallAttachments}
                    />
                </section>
            </SettingsPanel>
        </div>
    );
};

export default InterfaceSettingsTab;
