// src/components/settings/tabs/InterfaceSettingsTab.tsx
import React from 'react';
import TextInput from '../../common/TextInput';
import { IoSparklesOutline } from 'react-icons/io5';
import SettingsPanel from '../SettingsPanel'; // Import the new SettingsPanel

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
    currentShowProcessingIndicators: boolean; // Add this line
    onToggleShowProcessingIndicators: () => void; // Add this line
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
    currentShowProcessingIndicators, // Destructure new prop
    onToggleShowProcessingIndicators, // Destructure new prop
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
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { // Explicitly type the event
                                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3Cline x1='12' y1='8' x2='12' y2='12'%3E%3C/line%3Cline x1='12' y1='16' x2='12.01' y2='16'%3E%3C/line%3E%3C/svg%3E"; // Fallback to a generic error icon
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
                    <div className="flex items-center justify-between py-2 border-t border-[var(--color-settings-section-border)]">
                        <div>
                            <label htmlFor="code-highlight-toggle" className="block text-sm font-medium text-[var(--color-settings-section-title-text)]">
                                Realce de Sintaxe de Código
                            </label>
                            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">
                                Ativa ou desativa o realce de sintaxe para blocos de código nas respostas da IA.
                            </p>
                        </div>
                        <button
                            id="code-highlight-toggle"
                            onClick={onToggleCodeHighlight}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                                ${currentCodeHighlightEnabled ? 'bg-[var(--color-toggle-switch-bg-on)]' : 'bg-[var(--color-toggle-switch-bg-off)]'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-toggle-switch-handle-bg)] shadow-lg shadow-[var(--color-toggle-switch-handle-shadow)] ring-0 transition-transform
                                    ${currentCodeHighlightEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>

                    {/* Web Search Toggle */}
                    <div className="flex items-center justify-between py-2 border-t border-[var(--color-settings-section-border)]">
                        <div>
                            <label htmlFor="web-search-toggle" className="block text-sm font-medium text-[var(--color-settings-section-title-text)]">
                                Habilitar Pesquisa Web
                            </label>
                            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">
                                Permite que a IA acesse a internet para obter informações atualizadas.
                            </p>
                        </div>
                        <button
                            id="web-search-toggle"
                            onClick={onToggleEnableWebSearch}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                                ${currentEnableWebSearchEnabled ? 'bg-[var(--color-toggle-switch-bg-on)]' : 'bg-[var(--color-toggle-switch-bg-off)]'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-toggle-switch-handle-bg)] shadow-lg shadow-[var(--color-toggle-switch-handle-shadow)] ring-0 transition-transform
                                    ${currentEnableWebSearchEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>

                    {/* Attachments Toggle */}
                    <div className="flex items-center justify-between py-2 border-t border-[var(--color-settings-section-border)]">
                        <div>
                            <label htmlFor="attachments-toggle" className="block text-sm font-medium text-[var(--color-settings-section-title-text)]">
                                Habilitar Anexos
                            </label>
                            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">
                                Permite enviar imagens e áudios para a IA.
                            </p>
                        </div>
                        <button
                            id="attachments-toggle"
                            onClick={onToggleAttachmentsEnabled}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                                ${currentAttachmentsEnabled ? 'bg-[var(--color-toggle-switch-bg-on)]' : 'bg-[var(--color-toggle-switch-bg-off)]'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-toggle-switch-handle-bg)] shadow-lg shadow-[var(--color-toggle-switch-handle-shadow)] ring-0 transition-transform
                                    ${currentAttachmentsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>

                    {/* Hide Navigation Toggle */}
                    <div className="flex items-center justify-between py-2 border-t border-[var(--color-settings-section-border)]">
                        <div>
                            <label htmlFor="hide-navigation-toggle" className="block text-sm font-medium text-[var(--color-settings-section-title-text)]">
                                Esconder Navegação
                            </label>
                            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">
                                Oculta a barra lateral de navegação por padrão.
                            </p>
                        </div>
                        <button
                            id="hide-navigation-toggle"
                            onClick={onToggleHideNavigation}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                                ${currentHideNavigation ? 'bg-[var(--color-toggle-switch-bg-on)]' : 'bg-[var(--color-toggle-switch-bg-off)]'}`}
                        >
                            <span
                                aria-hidden="true"
                                className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-toggle-switch-handle-bg)] shadow-lg shadow-[var(--color-toggle-switch-handle-shadow)] ring-0 transition-transform
                                    ${currentHideNavigation ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>

                    {/* New: Show Processing Indicators Toggle */}
                    <div className="flex items-center justify-between py-2 border-t border-[var(--color-settings-section-border)]">
                        <div>
                            <label htmlFor="show-indicators-toggle" className="block text-sm font-medium text-[var(--color-settings-section-title-text)]">
                                Exibir Indicadores de Status
                            </label>
                            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">
                                Controla a visibilidade dos indicadores de processamento de arquivos e chamadas de função nas mensagens da IA.
                            </p>
                        </div>
                        <button
                            id="show-indicators-toggle"
                            onClick={onToggleShowProcessingIndicators}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                                ${currentShowProcessingIndicators ? 'bg-[var(--color-toggle-switch-bg-on)]' : 'bg-[var(--color-toggle-switch-bg-off)]'}`}
                        >
                            <span
                                aria-hidden="true"
                                className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-toggle-switch-handle-bg)] shadow-lg shadow-[var(--color-toggle-switch-handle-shadow)] ring-0 transition-transform
                                    ${currentShowProcessingIndicators ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>
                </section>
            </SettingsPanel>
        </div>
    );
};

export default InterfaceSettingsTab;
