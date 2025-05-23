// src/components/settings/tabs/DataSettingsTab.tsx
import React, { useState, useCallback, useRef } from 'react';
import Button from '../../common/Button';
import { IoCloudUploadOutline, IoCloudDownloadOutline, IoTrashOutline, IoCloseOutline } from 'react-icons/io5';
import type { AppSettings, Conversation, Memory, FunctionDeclaration, GeminiModelConfig } from '../../../types'; // Import GeminiModelConfig
import { useDialog } from '../../../contexts/DialogContext';
import { useMemories } from '../../../contexts/MemoryContext'; // Import useMemories
import { useConversations } from '../../../contexts/ConversationContext'; // Import useConversations

export type DataSettingsTabProps = object

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
    enableWebSearch?: boolean;
    enableAttachments?: boolean;
    hideNavigation?: boolean;
}

const DataSettingsTab: React.FC<DataSettingsTabProps> = () => {
    const { showDialog } = useDialog();
    const { memories, deleteMemory, updateMemory, clearAllMemories, replaceAllMemories } = useMemories(); // Use useMemories hook
    const { deleteAllConversations } = useConversations(); // Use useConversations hook

    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
    const [editedMemoryContent, setEditedMemoryContent] = useState<string>('');

    // Determine active tab for display purposes within this component
    // This component is used for both "Memories" and "Data" tabs in SettingsModal
    // We can infer which section to show based on the URL or a prop if passed,
    // but for simplicity, if it's rendered, it means it's the active tab.
    // The original code had `activeTab: 'memories' | 'data'` as a prop,
    // but since this component is now used for both, and the content is conditional,
    // I'll assume the context of its usage in SettingsModal determines what's shown.
    // For this file, I'll assume it's always showing the "Data" section,
    // and MemoriesSettingsTab.tsx handles the "Memories" section.
    // If this component is *only* for "Data", then the `activeTab` prop is not needed.
    // If it's meant to render *both* based on an internal state or prop, then that prop is needed.
    // Given the previous commit structure, it seems `MemoriesSettingsTab.tsx` is separate.
    // So, this `DataSettingsTab.tsx` will focus only on the Data import/export/clear.

    const handleExportData = useCallback(() => {
        showDialog({
            title: "Exportar Dados",
            message: "Selecione quais dados você deseja exportar:",
            type: "confirm",
            confirmText: "Exportar",
            cancelText: "Cancelar",
            onConfirm: async () => {
                const appSettings: AppSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                // Conversations and memories are already available from hooks, but localStorage is used for consistency with import
                const conversationsData: Conversation[] = JSON.parse(localStorage.getItem('conversations') || '[]');
                const memoriesData: Memory[] = JSON.parse(localStorage.getItem('memories') || '[]');

                const exportData: UrlConfigFile = {
                    apiKey: appSettings.apiKey,
                    geminiModelConfig: appSettings.geminiModelConfig,
                    customPersonalityPrompt: appSettings.customPersonalityPrompt,
                    functionDeclarations: appSettings.functionDeclarations,
                    aiAvatarUrl: appSettings.aiAvatarUrl,
                    codeSynthaxHighlightEnabled: appSettings.codeSynthaxHighlightEnabled,
                    enableWebSearch: appSettings.enableWebSearch,
                    enableAttachments: appSettings.enableAttachments,
                    hideNavigation: appSettings.hideNavigation,
                    memories: memoriesData.map(m => ({
                        id: m.id,
                        content: m.content,
                        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp, // Ensure ISO string
                        sourceMessageId: m.sourceMessageId
                    }))
                };

                const dataStr = JSON.stringify({ appSettings: exportData, conversations: conversationsData }, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `loox_ai_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        });
    }, [showDialog]);

    const handleImportData = useCallback(() => {
        if (!selectedFile) {
            showDialog({
                title: "Erro de Importação",
                message: "Por favor, selecione um arquivo JSON para importar.",
                type: "alert",
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData: unknown = JSON.parse(event.target?.result as string); // Parse as unknown

                // Basic validation for importedData structure
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error("Invalid JSON structure.");
                }

                const { appSettings: importedAppSettingsRaw, conversations: importedConversationsRaw } = importedData as { appSettings?: unknown, conversations?: unknown };

                showDialog({
                    title: "Confirmar Importação",
                    message: (
                        <div>
                            <p>Você está prestes a importar dados. Isso <strong>substituirá</strong> suas configurações e conversas atuais.</p>
                            <p className="mt-2">Deseja continuar?</p>
                        </div>
                    ),
                    type: "confirm",
                    confirmText: "Importar e Substituir",
                    cancelText: "Cancelar",
                    onConfirm: () => {
                        if (importedAppSettingsRaw && typeof importedAppSettingsRaw === 'object') {
                            const importedAppSettings: UrlConfigFile = importedAppSettingsRaw as UrlConfigFile; // Assert after basic check
                            const currentAppSettings: AppSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');

                            // Merge imported settings with existing ones, prioritizing imported values
                            const newAppSettings: AppSettings = {
                                ...currentAppSettings,
                                apiKey: importedAppSettings.apiKey ?? currentAppSettings.apiKey,
                                geminiModelConfig: { ...currentAppSettings.geminiModelConfig, ...importedAppSettings.geminiModelConfig },
                                customPersonalityPrompt: importedAppSettings.customPersonalityPrompt ?? currentAppSettings.customPersonalityPrompt,
                                functionDeclarations: importedAppSettings.functionDeclarations ?? currentAppSettings.functionDeclarations,
                                aiAvatarUrl: importedAppSettings.aiAvatarUrl ?? currentAppSettings.aiAvatarUrl,
                                codeSynthaxHighlightEnabled: importedAppSettings.codeSynthaxHighlightEnabled ?? currentAppSettings.codeSynthaxHighlightEnabled,
                                enableWebSearch: importedAppSettings.enableWebSearch ?? currentAppSettings.enableWebSearch,
                                enableAttachments: importedAppSettings.enableAttachments ?? currentAppSettings.enableAttachments,
                                hideNavigation: importedAppSettings.hideNavigation ?? currentAppSettings.hideNavigation,
                                isDarkModeEnabled: currentAppSettings.isDarkModeEnabled, // Keep existing dark mode setting
                            };
                            localStorage.setItem('appSettings', JSON.stringify(newAppSettings));

                            // Handle memories separately as they are managed by context
                            if (importedAppSettings.memories && Array.isArray(importedAppSettings.memories)) {
                                const newMemories: Memory[] = importedAppSettings.memories.map(m => ({
                                    id: m.id || crypto.randomUUID(), // Ensure ID exists
                                    content: m.content,
                                    timestamp: new Date(m.timestamp),
                                    sourceMessageId: m.sourceMessageId
                                }));
                                replaceAllMemories(newMemories);
                            }
                        }

                        if (importedConversationsRaw && Array.isArray(importedConversationsRaw)) {
                            // Basic validation for conversations array elements
                            const validatedConversations: Conversation[] = importedConversationsRaw.map((c: any) => ({
                                id: c.id || crypto.randomUUID(),
                                title: c.title || 'Untitled Conversation',
                                messages: Array.isArray(c.messages) ? c.messages.map((m: any) => ({
                                    id: m.id || crypto.randomUUID(),
                                    text: m.text || '',
                                    sender: m.sender || 'user',
                                    timestamp: new Date(m.timestamp),
                                    metadata: m.metadata,
                                })) : [],
                                createdAt: new Date(c.createdAt),
                                updatedAt: new Date(c.updatedAt),
                            }));
                            localStorage.setItem('conversations', JSON.stringify(validatedConversations));
                            // Force a reload of conversations in context
                            window.dispatchEvent(new Event('storage')); // Simulate storage event
                        }

                        showDialog({
                            title: "Importação Concluída",
                            message: "Dados importados com sucesso!",
                            type: "alert",
                        });
                        setSelectedFile(null); // Clear selected file after import
                    }
                });
            } catch (e: unknown) { // Catch unknown error type
                console.error("Erro ao parsear arquivo JSON:", e);
                showDialog({
                    title: "Erro de Importação",
                    message: `O arquivo selecionado não é um JSON válido ou está corrompido. Detalhes: ${e instanceof Error ? e.message : String(e)}`,
                    type: "alert",
                });
            }
        };
        reader.readAsText(selectedFile);
    }, [selectedFile, showDialog, replaceAllMemories]);

    const handleClearAllConversations = useCallback(() => {
        showDialog({
            title: "Confirmar Exclusão de Conversas",
            message: "Tem certeza de que deseja excluir TODAS as suas conversas? Esta ação não pode ser desfeita.",
            type: "confirm",
            confirmText: "Excluir Tudo",
            cancelText: "Cancelar",
            onConfirm: () => {
                deleteAllConversations();
                showDialog({
                    title: "Conversas Excluídas",
                    message: "Todas as conversas foram excluídas com sucesso.",
                    type: "alert",
                });
            }
        });
    }, [showDialog, deleteAllConversations]);

    const handleClearAllMemories = useCallback(() => {
        showDialog({
            title: "Confirmar Exclusão de Memórias",
            message: "Tem certeza de que deseja excluir TODAS as suas memórias? Esta ação não pode ser desfeita.",
            type: "confirm",
            confirmText: "Excluir Tudo",
            cancelText: "Cancelar",
            onConfirm: () => {
                clearAllMemories();
                showDialog({
                    title: "Memórias Excluídas",
                    message: "Todas as memórias foram excluídas com sucesso.",
                    type: "alert",
                });
            }
        });
    }, [showDialog, clearAllMemories]);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/json') {
                setSelectedFile(file);
            } else {
                showDialog({
                    title: "Arquivo Inválido",
                    message: "Por favor, arraste e solte um arquivo JSON.",
                    type: "alert",
                });
            }
        }
    }, [showDialog]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === 'application/json') {
                setSelectedFile(file);
            } else {
                showDialog({
                    title: "Arquivo Inválido",
                    message: "Por favor, selecione um arquivo JSON.",
                    type: "alert",
                });
                e.target.value = ''; // Clear the input
            }
        }
    }, [showDialog]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const triggerFileInput = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // These memory-related functions are now handled by MemoriesSettingsTab.tsx
    // Keeping them here for completeness if this component were to manage memories directly,
    // but they are not used in the current component structure.
    const handleStartEditMemory = useCallback((memory: Memory) => {
        setEditingMemoryId(memory.id);
        setEditedMemoryContent(memory.content);
    }, []);

    const handleSaveMemory = useCallback((memoryId: string) => {
        if (editedMemoryContent.trim()) {
            updateMemory(memoryId, editedMemoryContent.trim());
            setEditingMemoryId(null);
            setEditedMemoryContent('');
        } else {
            showDialog({
                title: "Conteúdo Vazio",
                message: "O conteúdo da memória não pode ser vazio.",
                type: "alert",
            });
        }
    }, [editedMemoryContent, updateMemory, showDialog]);

    const handleCancelEditMemory = useCallback(() => {
        setEditingMemoryId(null);
        setEditedMemoryContent('');
    }, []);

    const handleDeleteMemory = useCallback((memoryId: string) => {
        showDialog({
            title: "Confirmar Exclusão de Memória",
            message: "Tem certeza de que deseja excluir esta memória? Esta ação não pode ser desfeita.",
            type: "confirm",
            confirmText: "Excluir",
            cancelText: "Cancelar",
            onConfirm: () => {
                deleteMemory(memoryId);
                showDialog({
                    title: "Memória Excluída",
                    message: "A memória foi excluída com sucesso.",
                    type: "alert",
                });
            }
        });
    }, [showDialog, deleteMemory]);

    const sortedMemories = [...memories].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());


    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)]">
                Importar/Exportar Dados
            </h2>
            <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4 border-b border-[var(--color-settings-section-border)]">
                Importe ou exporte suas configurações, conversas e memórias para backup ou transferência.
            </p>

            <section className="space-y-4">
                <div className="bg-[var(--color-data-import-export-bg)] p-4 rounded-lg border border-[var(--color-data-import-export-border)] shadow-sm">
                    <h3 className="text-lg font-medium text-[var(--color-data-import-export-text)] mb-3">Exportar Dados</h3>
                    <p className="text-sm text-[var(--color-data-import-export-text)] mb-4">
                        Crie um backup de suas configurações e conversas.
                    </p>
                    <Button variant="secondary" onClick={handleExportData} className="w-full sm:w-auto">
                        <IoCloudDownloadOutline className="mr-2" size={20} /> Exportar Dados
                    </Button>
                </div>

                <div className="bg-[var(--color-data-import-export-bg)] p-4 rounded-lg border border-[var(--color-data-import-export-border)] shadow-sm">
                    <h3 className="text-lg font-medium text-[var(--color-data-import-export-text)] mb-3">Importar Dados</h3>
                    <p className="text-sm text-[var(--color-data-import-export-text)] mb-4">
                        Carregue um arquivo de backup para restaurar suas configurações e conversas.
                        Isso substituirá os dados existentes.
                    </p>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-all duration-200 ease-in-out
                            ${isDragging ? 'border-[var(--color-data-drag-drop-active-border)] bg-[var(--color-data-drag-drop-hover-bg)] text-[var(--color-data-drag-drop-active-text)]' : 'border-[var(--color-data-drag-drop-border)] bg-transparent text-[var(--color-data-drag-drop-text)] hover:bg-[var(--color-data-drag-drop-hover-bg)]'}`}
                    >
                        <IoCloudUploadOutline size={40} className="mb-3" />
                        <p className="text-center text-sm">
                            Arraste e solte seu arquivo JSON aqui, ou
                        </p>
                        <Button variant="secondary" onClick={triggerFileInput} className="mt-3">
                            Selecionar Arquivo
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="application/json"
                            className="hidden"
                        />
                        {selectedFile && (
                            <p className="mt-3 text-sm text-[var(--color-data-drag-drop-file-text)]">
                                Arquivo selecionado: <span className="font-medium">{selectedFile.name}</span>
                                <Button variant="ghost" size="icon-sm" onClick={() => setSelectedFile(null)} className="ml-2 text-[var(--color-data-drag-drop-file-remove-icon)] hover:bg-transparent">
                                    <IoCloseOutline size={18} />
                                </Button>
                            </p>
                        )}
                    </div>
                    <Button
                        variant="primary"
                        onClick={handleImportData}
                        disabled={!selectedFile}
                        className="w-full sm:w-auto mt-4"
                    >
                        Importar Dados
                    </Button>
                </div>

                <div className="bg-[var(--color-data-import-export-bg)] p-4 rounded-lg border border-[var(--color-data-import-export-border)] shadow-sm">
                    <h3 className="text-lg font-medium text-[var(--color-data-import-export-text)] mb-3">Limpar Dados</h3>
                    <p className="text-sm text-[var(--color-data-import-export-text)] mb-4">
                        Exclua todas as suas conversas ou memórias. Esta ação é irreversível.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="danger" onClick={handleClearAllConversations} className="w-full sm:w-auto">
                            <IoTrashOutline className="mr-2" size={20} /> Excluir Todas as Conversas
                        </Button>
                        <Button variant="danger" onClick={handleClearAllMemories} className="w-full sm:w-auto">
                            <IoTrashOutline className="mr-2" size={20} /> Excluir Todas as Memórias
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default DataSettingsTab;
