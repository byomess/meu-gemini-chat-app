// src/hooks/useGoogleDriveSync.ts
import { useCallback } from 'react';
import { useAppSettings } from '../contexts/AppSettingsContext';
// import { useMemories } from '../contexts/MemoryContext'; // Removed
import {
    loadAndInitGapiClient,
    findOrCreateAppFolder,
    getMemoriesFileId,
    readFileContent,
    uploadFileContent,
    // getFileModifiedTime // Not directly used in syncMemories, as we rely on lastModifiedAt in JSON
} from '../services/googleDriveApiService';
import type { Memory, DriveMemory } from '../types';

const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file profile email'; // Must match scope used in googleAuthService

interface UseGoogleDriveSyncProps {
    memories: Memory[];
    replaceAllMemories: (newMemories: Memory[], source?: string) => Memory[];
}

export const useGoogleDriveSync = ({ memories, replaceAllMemories }: UseGoogleDriveSyncProps) => {
    const { settings, setGoogleDriveSyncStatus, updateGoogleDriveLastSync, setGoogleDriveError } = useAppSettings();
    // const { memories, replaceAllMemories } = useMemories(); // Removed

    const syncMemories = useCallback(async () => { 
        if (!settings.googleDriveAccessToken) {
            console.warn("Google Drive sync attempted without access token. Aborting.");
            setGoogleDriveError("Não conectado ao Google Drive.");
            setGoogleDriveSyncStatus('Disconnected'); // Ensure status is correct
            return;
        }

        setGoogleDriveSyncStatus('Syncing');
        setGoogleDriveError(undefined); // Clear previous errors

        try {
            // 1. Initialize GAPI client with current token
            // This also ensures the gapi.client.drive library is loaded
            await loadAndInitGapiClient(settings.googleDriveAccessToken, GOOGLE_DRIVE_SCOPES);

            // 2. Find or create the Loox app folder
            const appFolderId = await findOrCreateAppFolder();

            // 3. Get remote memories file ID and content
            let remoteFileId = await getMemoriesFileId(appFolderId);
            let remoteMemories: DriveMemory[] = [];

            if (remoteFileId) {
                try {
                    const content = await readFileContent(remoteFileId);
                    const parsedContent = JSON.parse(content);
                    if (Array.isArray(parsedContent)) {
                        remoteMemories = parsedContent;
                    } else {
                        console.warn("Remote memories file content is not a valid JSON array. Treating as empty.");
                        setGoogleDriveError("Conteúdo do arquivo de memórias no Drive inválido. Será sobrescrito.");
                        remoteMemories = [];
                    }
                } catch (parseError) {
                    console.error("Error parsing remote memories JSON:", parseError);
                    // If parsing fails, treat remote as empty to avoid blocking sync
                    remoteMemories = [];
                    setGoogleDriveError("Erro ao ler arquivo de memórias do Drive. Tentando sobrescrever.");
                }
            }

            // 4. Prepare local memories for merge
            // `memories` here are `allMemories` from MemoryContext, including soft-deleted ones
            const localMemoriesAsDrive: DriveMemory[] = memories.map(m => ({
                id: m.id,
                content: m.content,
                lastModifiedAt: m.timestamp.toISOString(),
                isDeleted: m.isDeleted || false,
            }));

            // 5. Merge Logic with Soft Delete
            const mergedMemoriesMap = new Map<string, DriveMemory>();

            // Process all unique IDs from both local and remote
            const allIds = new Set([...localMemoriesAsDrive.map(m => m.id), ...remoteMemories.map(m => m.id)]);

            allIds.forEach(id => {
                const localMem = localMemoriesAsDrive.find(m => m.id === id);
                const remoteMem = remoteMemories.find(m => m.id === id);

                if (localMem && remoteMem) {
                    // Memory exists in both local and remote
                    const localTimestamp = new Date(localMem.lastModifiedAt).getTime();
                    const remoteTimestamp = new Date(remoteMem.lastModifiedAt).getTime();
                    const localIsDeleted = localMem.isDeleted || false;
                    const remoteIsDeleted = remoteMem.isDeleted || false;

                    if (localIsDeleted && remoteIsDeleted) {
                        // Both are deleted, keep the one with the newer timestamp (most recent deletion)
                        mergedMemoriesMap.set(id, localTimestamp > remoteTimestamp ? localMem : remoteMem);
                    } else if (localIsDeleted && !remoteIsDeleted) {
                        // Local is deleted, remote is not
                        // If local deletion is newer, it takes precedence
                        // Otherwise, remote (undeleted or updated) takes precedence
                        mergedMemoriesMap.set(id, localTimestamp > remoteTimestamp ? localMem : remoteMem);
                    } else if (!localIsDeleted && remoteIsDeleted) {
                        // Local is not deleted, remote is
                        // If remote deletion is newer, it takes precedence
                        // Otherwise, local (undeleted or updated) takes precedence
                        mergedMemoriesMap.set(id, remoteTimestamp > localTimestamp ? remoteMem : localMem);
                    } else {
                        // Neither is deleted, keep the one with the newer timestamp
                        mergedMemoriesMap.set(id, localTimestamp > remoteTimestamp ? localMem : remoteMem);
                    }
                } else if (localMem) {
                    // Memory only exists locally
                    mergedMemoriesMap.set(id, localMem);
                } else if (remoteMem) {
                    // Memory only exists remotely
                    mergedMemoriesMap.set(id, remoteMem);
                }
            });

            const finalMergedMemories: DriveMemory[] = Array.from(mergedMemoriesMap.values());

            // Sort by lastModifiedAt descending for consistency
            finalMergedMemories.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime());

            // 6. Upload merged memories to Google Drive
            const mergedContent = JSON.stringify(finalMergedMemories, null, 2);
            const newFileId = await uploadFileContent(mergedContent, appFolderId, remoteFileId);

            // If a new file was created, update remoteFileId for future operations
            if (!remoteFileId) {
                remoteFileId = newFileId;
            }

            // 7. Update local state with the final merged memories
            const updatedLocalMemories: Memory[] = finalMergedMemories.map(dm => ({
                id: dm.id,
                content: dm.content,
                timestamp: new Date(dm.lastModifiedAt),
                isDeleted: dm.isDeleted || false, // Ensure isDeleted is mapped back
            }));
            // Capture the result of replaceAllMemories
            replaceAllMemories(updatedLocalMemories, 'sync');

            // onMemoriesUpdatedBySync callback removed
            updateGoogleDriveLastSync(new Date().toISOString());
            setGoogleDriveSyncStatus('Synced');
            console.log("Google Drive sync successful!");

        } catch (error: unknown) {
            console.error("Google Drive sync failed:", error);
            if (error instanceof Error) {
                setGoogleDriveError(error.message || "Falha desconhecida na sincronização com Google Drive.");
            } else {
                setGoogleDriveError("Falha desconhecida na sincronização com Google Drive.");
            }
            setGoogleDriveSyncStatus('Error');
        }
    }, [settings.googleDriveAccessToken, memories, replaceAllMemories, setGoogleDriveSyncStatus, updateGoogleDriveLastSync, setGoogleDriveError]);

    return { syncMemories };
};
