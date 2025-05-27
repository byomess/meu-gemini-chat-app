import React, { useState, useCallback, useRef, useEffect } from 'react';
import Button from '../../common/Button';
import { IoCloudUploadOutline, IoCloudDownloadOutline, IoTrashOutline, IoCloseOutline, IoLogoGoogle, IoUnlinkOutline, IoRefreshOutline, IoDocumentOutline } from 'react-icons/io5';
import { FaSpinner } from 'react-icons/fa'; // Import spinner icon
import type { AppSettings, Conversation, Memory, UrlConfigFile, RawImportedConversation, RawImportedMessage } from '../../../types';
import { useDialog } from '../../../contexts/DialogContext';
import SettingsPanel from '../SettingsPanel';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import {
    initGoogleTokenClient,
    requestAccessToken,
    fetchUserProfile,
    revokeAccessToken
} from '../../../services/googleAuthService';
import useIsMobile from '../../../hooks/useIsMobile'; // Import the hook

export interface DataSettingsTabProps {
    syncDriveData: () => Promise<void>;
}

const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file profile email';

const DataSettingsTab: React.FC<DataSettingsTabProps> = ({ syncDriveData }) => {
    const { showDialog } = useDialog();
    const { settings, connectGoogleDrive, disconnectGoogleDrive, setGoogleDriveSyncStatus, setGoogleDriveError } = useAppSettings();
    const isMobile = useIsMobile(); // Use the hook to detect mobile

    const [isGoogleClientInitialized, setIsGoogleClientInitialized] = useState(false);
    const [authActionLoading, setAuthActionLoading] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleExportData = useCallback(() => {
        showDialog({
            title: "Exportar Dados",
            message: "Selecione quais dados você deseja exportar:",
            type: "confirm",
            confirmText: "Exportar",
            cancelText: "Cancelar",
            onConfirm: async () => {
                const appSettings: AppSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
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
                        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
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
                const importedData: unknown = JSON.parse(event.target?.result as string);

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
                            const importedAppSettings: UrlConfigFile = importedAppSettingsRaw as UrlConfigFile;
                            const currentAppSettings: AppSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');

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
                            };
                            localStorage.setItem('appSettings', JSON.stringify(newAppSettings));

                            if (importedAppSettings.memories && Array.isArray(importedAppSettings.memories)) {
                                const newMemories: Memory[] = importedAppSettings.memories.map(m => ({
                                    id: m.id || crypto.randomUUID(),
                                    content: m.content,
                                    timestamp: new Date(m.timestamp),
                                    sourceMessageId: m.sourceMessageId
                                }));
                                localStorage.setItem('memories', JSON.stringify(newMemories));
                                window.dispatchEvent(new Event('storage'));
                            }
                        }

                        if (importedConversationsRaw && Array.isArray(importedConversationsRaw)) {
                            const validatedConversations: Conversation[] = importedConversationsRaw.map((c: RawImportedConversation) => ({
                                id: c.id || crypto.randomUUID(),
                                title: c.title || 'Untitled Conversation',
                                messages: Array.isArray(c.messages) ? c.messages.map((m: RawImportedMessage) => ({
                                    id: m.id || crypto.randomUUID(),
                                    text: m.text || '',
                                    sender: m.sender || 'user',
                                    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
                                    metadata: m.metadata,
                                })) : [],
                                createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
                                updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
                            }));
                            localStorage.setItem('conversations', JSON.stringify(validatedConversations));
                            window.dispatchEvent(new Event('storage'));
                        }

                        showDialog({
                            title: "Importação Concluída",
                            message: "Dados importados com sucesso!",
                            type: "alert",
                        });
                        setSelectedFile(null);
                    }
                });
            } catch (e: unknown) {
                console.error("Erro ao parsear arquivo JSON:", e);
                showDialog({
                    title: "Erro de Importação",
                    message: `O arquivo selecionado não é um JSON válido ou está corrompido. Detalhes: ${e instanceof Error ? e.message : String(e)}`,
                    type: "alert",
                });
            }
        };
        reader.readAsText(selectedFile);
    }, [selectedFile, showDialog]);

    const handleClearAllConversations = useCallback(() => {
        showDialog({
            title: "Confirmar Exclusão de Conversas",
            message: "Tem certeza de que deseja excluir TODAS as suas conversas? Esta ação não pode ser desfeita.",
            type: "confirm",
            confirmText: "Excluir Tudo",
            cancelText: "Cancelar",
            onConfirm: () => {
                localStorage.removeItem('conversations');
                window.dispatchEvent(new Event('storage'));
                showDialog({
                    title: "Conversas Excluídas",
                    message: "Todas as conversas foram excluídas com sucesso.",
                    type: "alert",
                });
            }
        });
    }, [showDialog]);

    const handleClearAllMemories = useCallback(() => {
        showDialog({
            title: "Confirmar Exclusão de Memórias",
            message: "Tem certeza de que deseja excluir TODAS as suas memórias? Esta ação não pode ser desfeita.",
            type: "confirm",
            confirmText: "Excluir Tudo",
            cancelText: "Cancelar",
            onConfirm: () => {
                localStorage.removeItem('memories');
                window.dispatchEvent(new Event('storage'));
                showDialog({
                    title: "Memórias Excluídas",
                    message: "Todas as memórias foram excluídas com sucesso.",
                    type: "alert",
                });
            }
        });
    }, [showDialog]);

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
                e.target.value = '';
            }
        }
    }, [showDialog]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const triggerFileInput = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // Initialize Google Token Client
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!clientId) {
            console.error("Google Client ID (VITE_GOOGLE_CLIENT_ID) is not configured.");
            setGoogleDriveError("Google integration is not configured pelo administrador.");
            setIsGoogleClientInitialized(false);
            return;
        }

        const attemptInit = () => {
            if (typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.oauth2) {
                initGoogleTokenClient(
                    clientId,
                    GOOGLE_DRIVE_SCOPES,
                    async (tokenResponse) => {
                        setAuthActionLoading(true);
                        setGoogleDriveSyncStatus('Connecting');
                        try {
                            const userProfile = await fetchUserProfile(tokenResponse.access_token);
                            connectGoogleDrive(tokenResponse.access_token, userProfile);
                            showDialog({ title: "Google Drive Conectado", message: `Conectado como ${userProfile.email}.`, type: 'alert' });
                        } catch (error) {
                            console.error("Error fetching user profile or connecting:", error);
                            const errorMessage = error instanceof Error ? error.message : "Falha ao obter perfil do usuário.";
                            setGoogleDriveError(errorMessage);
                        } finally {
                            setAuthActionLoading(false);
                        }
                    },
                    (error: unknown) => {
                        console.error("Google Auth Error:", error);
                        let errorMessage = "Falha na autenticação com Google Drive.";
                        if (typeof error === 'object' && error !== null) {
                            if ('type' in error && error.type === 'popup_closed') {
                                errorMessage = "Autenticação cancelada: Janela fechada pelo usuário.";
                            } else if ('error' in error && error.error === 'access_denied') {
                                errorMessage = "Acesso negado. Permissão não concedida.";
                            } else if ('message' in error && typeof error.message === 'string') {
                                errorMessage = error.message;
                            }
                        }
                        setGoogleDriveError(errorMessage);
                        setGoogleDriveSyncStatus('Disconnected');
                        setAuthActionLoading(false);
                    }
                );
                setIsGoogleClientInitialized(true);
            } else {
                setTimeout(attemptInit, 100);
            }
        };

        attemptInit();
    }, [connectGoogleDrive, setGoogleDriveError, setGoogleDriveSyncStatus, showDialog]);

    const handleConnectGoogleDrive = useCallback(() => {
        if (!isGoogleClientInitialized) {
            showDialog({ title: "Erro", message: "Cliente Google não inicializado. Verifique a configuração ou tente recarregar.", type: 'alert' });
            return;
        }
        setAuthActionLoading(true);
        setGoogleDriveSyncStatus('Connecting');
        setGoogleDriveError(undefined);
        requestAccessToken();
    }, [isGoogleClientInitialized, showDialog, setGoogleDriveSyncStatus, setGoogleDriveError]);

    const handleDisconnectGoogleDrive = useCallback(() => {
        if (settings.googleDriveAccessToken) {
            setAuthActionLoading(true);
            revokeAccessToken(settings.googleDriveAccessToken, () => {
                disconnectGoogleDrive();
                setAuthActionLoading(false);
                showDialog({ title: "Google Drive Desconectado", message: "Sua conta foi desconectada.", type: 'alert' });
            });
        }
    }, [settings.googleDriveAccessToken, disconnectGoogleDrive, showDialog]);

    const handleManualSync = useCallback(() => {
        if (settings.googleDriveAccessToken) {
            syncDriveData();
        } else {
            showDialog({
                title: "Não Conectado",
                message: "Por favor, conecte-se ao Google Drive para iniciar a sincronização.",
                type: "alert",
            });
        }
    }, [settings.googleDriveAccessToken, syncDriveData, showDialog]);

    const isSyncing = settings.googleDriveSyncStatus === 'Syncing';

    return (
        <div className="space-y-6">
            <SettingsPanel
                title="Importar/Exportar Dados"
                description="Importe ou exporte suas configurações, conversas e memórias para backup ou transferência."
            >
                <section className="space-y-6"> {/* Increased space between sections */}
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

                        {/* Always present file input and selection display */}
                        <Button variant="secondary" onClick={triggerFileInput} className="mt-3 w-full sm:w-auto">
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
                            <div className="mt-4 flex items-center bg-[var(--color-data-drag-drop-file-bg)] p-2 rounded-md shadow-inner">
                                <IoDocumentOutline size={18} className="mr-2 text-[var(--color-data-drag-drop-file-icon)]" />
                                <span className="text-sm font-medium text-[var(--color-data-drag-drop-file-text)]">{selectedFile.name}</span>
                                <Button variant="ghost" size="icon-sm" onClick={() => setSelectedFile(null)} className="ml-2 text-[var(--color-data-drag-drop-file-remove-icon)] hover:bg-transparent">
                                    <IoCloseOutline size={18} />
                                </Button>
                            </div>
                        )}

                        {/* Conditional drag-and-drop area for non-mobile devices */}
                        {!isMobile && (
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-all duration-200 ease-in-out mt-4
                                    ${isDragging ? 'border-[var(--color-data-drag-drop-active-border)] bg-[var(--color-data-drag-drop-hover-bg)] text-[var(--color-data-drag-drop-active-text)]' : 'border-[var(--color-data-drag-drop-border)] bg-transparent text-[var(--color-data-drag-drop-text)] hover:bg-[var(--color-data-drag-drop-hover-bg)]'}`}
                            >
                                <IoCloudUploadOutline size={40} className="mb-3" />
                                <p className="text-center text-sm font-semibold">
                                    Arraste e solte seu arquivo JSON aqui
                                </p>
                                <p className="text-center text-xs text-[var(--color-data-drag-drop-text-secondary)] mb-3">
                                    ou clique no botão acima para selecionar um arquivo.
                                </p>
                            </div>
                        )}

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
            </SettingsPanel>

            <SettingsPanel
                title="Sincronização com Google Drive"
                description="Mantenha suas memórias sincronizadas com seu Google Drive pessoal."
            >
                <section className="bg-[var(--color-data-import-export-bg)] p-4 rounded-lg border border-[var(--color-data-import-export-border)] shadow-sm space-y-4"> {/* Adjusted space-y */}
                    {settings.googleDriveUser ? (
                        <>
                            <p className="text-sm text-[var(--color-data-import-export-text)]">
                                <span className="font-semibold">Conectado como:</span> <span className="font-medium">{settings.googleDriveUser.email}</span>
                            </p>
                            <p className="text-sm text-[var(--color-data-import-export-text)]">
                                <span className="font-semibold">Status:</span> <span className="font-medium">{settings.googleDriveSyncStatus}</span>
                                {settings.googleDriveLastSync && ` (Última sincronização: ${new Date(settings.googleDriveLastSync).toLocaleString()})`}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button variant="secondary" onClick={handleManualSync} disabled={isSyncing} className="w-full sm:w-auto">
                                    {isSyncing ? <FaSpinner className="animate-spin mr-2" size={20} /> : <IoRefreshOutline className="mr-2" size={20} />}
                                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                                </Button>
                                <Button variant="danger" onClick={handleDisconnectGoogleDrive} disabled={authActionLoading} className="w-full sm:w-auto">
                                    {authActionLoading ? <FaSpinner className="animate-spin mr-2" size={20} /> : <IoUnlinkOutline className="mr-2" size={20} />}
                                    Desconectar Google Drive
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-[var(--color-data-import-export-text)]">
                                Conecte sua conta Google para sincronizar suas memórias.
                                Seus dados serão armazenados em um arquivo JSON na pasta do aplicativo em seu Google Drive.
                            </p>
                            <Button
                                variant="primary"
                                onClick={handleConnectGoogleDrive}
                                disabled={!isGoogleClientInitialized || authActionLoading || !import.meta.env.VITE_GOOGLE_CLIENT_ID}
                                className="w-full sm:w-auto"
                            >
                                {authActionLoading ? <FaSpinner className="animate-spin mr-2" size={20} /> : <IoLogoGoogle className="mr-2" size={20} />}
                                Conectar com Google Drive
                            </Button>
                        </>
                    )}
                    {settings.googleDriveError && (
                        <p className="text-sm text-red-500 mt-2">Erro: {settings.googleDriveError}</p>
                    )}
                </section>
            </SettingsPanel>
        </div>
    );
};

export default DataSettingsTab;
