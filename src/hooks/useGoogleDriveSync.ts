// src/hooks/useGoogleDriveSync.ts
import { useCallback } from 'react';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useMemories } from '../contexts/MemoryContext';
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

export const useGoogleDriveSync = () => {
    const { settings, setGoogleDriveSyncStatus, updateGoogleDriveLastSync, setGoogleDriveError } = useAppSettings();
    const { memories, replaceAllMemories } = useMemories();

    const syncMemories = useCallback(async (onMemoriesUpdatedBySync?: (memories: Memory[]) => void) => {
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
            const localMemoriesAsDrive: DriveMemory[] = memories.map(m => ({
                id: m.id,
                content: m.content,
                lastModifiedAt: m.timestamp.toISOString(),
            }));

            // 5. Merge Logic (Last Write Wins per item)
            const mergedMemoriesMap = new Map<string, DriveMemory>();

            // Add all remote memories to the map first
            remoteMemories.forEach(m => {
                mergedMemoriesMap.set(m.id, m);
            });

            // Iterate local memories, merging with remote
            localMemoriesAsDrive.forEach(localMem => {
                const remoteMem = mergedMemoriesMap.get(localMem.id);
                if (remoteMem) {
                    // Conflict: keep the one with the newer timestamp
                    if (new Date(localMem.lastModifiedAt) > new Date(remoteMem.lastModifiedAt)) {
                        mergedMemoriesMap.set(localMem.id, localMem);
                    }
                    // else: remote is newer or same, keep remote (already in map)
                } else {
                    // Local memory not in remote, add it
                    mergedMemoriesMap.set(localMem.id, localMem);
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
            }));
            // Capture the result of replaceAllMemories
            const finalLocalMemories = replaceAllMemories(updatedLocalMemories);

            // Call the callback with the final local memories (the exact array reference from context)
            if (onMemoriesUpdatedBySync) {
                onMemoriesUpdatedBySync(finalLocalMemories);
            }
            updateGoogleDriveLastSync(new Date().toISOString());
            setGoogleDriveSyncStatus('Synced');
            console.log("Google Drive sync successful!");

        } catch (error: any) {
            console.error("Google Drive sync failed:", error);
            setGoogleDriveError(error.message || "Falha desconhecida na sincronização com Google Drive.");
            setGoogleDriveSyncStatus('Error');
        }
    }, [settings.googleDriveAccessToken, memories, replaceAllMemories, setGoogleDriveSyncStatus, updateGoogleDriveLastSync, setGoogleDriveError]);

    return { syncMemories };
};
