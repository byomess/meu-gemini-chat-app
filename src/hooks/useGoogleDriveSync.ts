// src/hooks/useGoogleDriveSync.ts
import { useCallback, useEffect } from 'react'; // ADDED useEffect
import { useAppSettings } from '../contexts/AppSettingsContext';
// import { useMemories } from '../contexts/MemoryContext'; // Removed
import {
    loadAndInitGapiClient,
    findOrCreateAppFolder,
    findFileIdByName, // MODIFIED
    readFileContent,
    uploadFileContent,
    // getFileModifiedTime // Not directly used in syncMemories, as we rely on lastModifiedAt in JSON
} from '../services/googleDriveApiService';
import type { Memory, DriveMemory, Conversation, RawImportedConversation, RawImportedMessage } from '../types'; // ADDED Conversation, RawImportedConversation, RawImportedMessage
import { MEMORIES_FILE_NAME, CONVERSATIONS_FILE_NAME } from '../services/googleDriveApiService'; // ADDED CONVERSATIONS_FILE_NAME

const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file profile email'; // Must match scope used in googleAuthService

interface UseGoogleDriveSyncProps {
    memories: Memory[]; // Should be allMemories
    replaceAllMemories: (newMemories: Memory[], source?: string) => Memory[];
    lastMemoryChangeSource: 'user' | 'sync' | null; // ADDED
    resetLastMemoryChangeSource: () => void; // ADDED

    conversations: Conversation[]; // Should be allConversations
    replaceAllConversations: (newConversations: Conversation[], source?: string) => void;
    lastConversationChangeSource: 'user' | 'sync' | null; // ADDED
    resetLastConversationChangeSource: () => void; // ADDED
}

export const useGoogleDriveSync = ({
    memories,
    replaceAllMemories,
    lastMemoryChangeSource, // ADDED
    resetLastMemoryChangeSource, // ADDED
    conversations,
    replaceAllConversations,
    lastConversationChangeSource, // ADDED
    resetLastConversationChangeSource, // ADDED
}: UseGoogleDriveSyncProps) => {
    const { settings, setGoogleDriveSyncStatus, updateGoogleDriveLastSync, setGoogleDriveError } = useAppSettings();

    const syncDriveData = useCallback(async () => { // RENAMED
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

            // --- Memories Sync Logic (existing) ---
            // 3. Get remote memories file ID and content
            let remoteMemoriesFileId = await findFileIdByName(appFolderId, MEMORIES_FILE_NAME); // MODIFIED
            let remoteMemories: DriveMemory[] = [];

            if (remoteMemoriesFileId) { // MODIFIED
                try {
                    const content = await readFileContent(remoteMemoriesFileId); // MODIFIED
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
            const mergedMemoriesContent = JSON.stringify(finalMergedMemories, null, 2); // RENAMED
            const newMemoriesFileId = await uploadFileContent(mergedMemoriesContent, appFolderId, remoteMemoriesFileId, MEMORIES_FILE_NAME); // MODIFIED

            // If a new file was created, update remoteMemoriesFileId for future operations
            if (!remoteMemoriesFileId) {
                remoteMemoriesFileId = newMemoriesFileId;
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

            // --- Conversations Sync Logic ---
            // 1. Get remote conversations file ID and content
            let remoteConversationsFileId = await findFileIdByName(appFolderId, CONVERSATIONS_FILE_NAME);
            let remoteConversations: RawImportedConversation[] = [];

            if (remoteConversationsFileId) {
                try {
                    const content = await readFileContent(remoteConversationsFileId);
                    const parsedContent = JSON.parse(content);
                    if (Array.isArray(parsedContent)) {
                        remoteConversations = parsedContent;
                    } else {
                        console.warn("Remote conversations file content is not a valid JSON array. Treating as empty.");
                        setGoogleDriveError("Conteúdo do arquivo de conversas no Drive inválido. Será sobrescrito.");
                        remoteConversations = [];
                    }
                } catch (parseError) {
                    console.error("Error parsing remote conversations JSON:", parseError);
                    remoteConversations = [];
                    setGoogleDriveError("Erro ao ler arquivo de conversas do Drive. Tentando sobrescrever.");
                }
            }

            // 2. Prepare local conversations for merge
            const localConversationsAsRaw: RawImportedConversation[] = conversations.map(c => ({
                id: c.id,
                title: c.title,
                createdAt: c.createdAt.toISOString(),
                updatedAt: c.updatedAt.toISOString(),
                isIncognito: c.isIncognito,
                isDeleted: c.isDeleted || false,
                messages: c.messages.map(m => ({
                    id: m.id,
                    text: m.text,
                    sender: m.sender,
                    timestamp: m.timestamp.toISOString(),
                    metadata: m.metadata,
                })),
            }));

            // 3. Merge Logic for Conversations (similar to memories)
            const mergedConversationsMap = new Map<string, RawImportedConversation>();
            const allConversationIds = new Set([...localConversationsAsRaw.map(c => c.id!), ...remoteConversations.map(c => c.id!)]);

            allConversationIds.forEach(id => {
                const localConv = localConversationsAsRaw.find(c => c.id === id);
                const remoteConv = remoteConversations.find(c => c.id === id);

                if (localConv && remoteConv) {
                    const localTimestamp = new Date(localConv.updatedAt!).getTime();
                    const remoteTimestamp = new Date(remoteConv.updatedAt!).getTime();
                    const localIsDeleted = localConv.isDeleted || false;
                    const remoteIsDeleted = remoteConv.isDeleted || false;

                    if (localIsDeleted && remoteIsDeleted) {
                        mergedConversationsMap.set(id, localTimestamp > remoteTimestamp ? localConv : remoteConv);
                    } else if (localIsDeleted && !remoteIsDeleted) {
                        mergedConversationsMap.set(id, localTimestamp > remoteTimestamp ? localConv : remoteConv);
                    } else if (!localIsDeleted && remoteIsDeleted) {
                        mergedConversationsMap.set(id, remoteTimestamp > localTimestamp ? remoteConv : localConv);
                    } else {
                        mergedConversationsMap.set(id, localTimestamp > remoteTimestamp ? localConv : remoteConv);
                    }
                } else if (localConv) {
                    mergedConversationsMap.set(id, localConv);
                } else if (remoteConv) {
                    mergedConversationsMap.set(id, remoteConv);
                }
            });

            const finalMergedConversationsRaw: RawImportedConversation[] = Array.from(mergedConversationsMap.values());
            finalMergedConversationsRaw.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());

            // 4. Upload merged conversations to Google Drive
            const mergedConversationsContent = JSON.stringify(finalMergedConversationsRaw, null, 2);
            const newConversationsFileId = await uploadFileContent(mergedConversationsContent, appFolderId, remoteConversationsFileId, CONVERSATIONS_FILE_NAME);

            if (!remoteConversationsFileId) {
                remoteConversationsFileId = newConversationsFileId;
            }

            // 5. Update local state with the final merged conversations
            const updatedLocalConversations: Conversation[] = finalMergedConversationsRaw.map(rc => ({
                id: rc.id!,
                title: rc.title!,
                createdAt: new Date(rc.createdAt!),
                updatedAt: new Date(rc.updatedAt!),
                isIncognito: rc.isIncognito,
                isDeleted: rc.isDeleted || false,
                messages: (rc.messages || []).map((rm: RawImportedMessage) => ({
                    id: rm.id,
                    text: rm.text,
                    sender: rm.sender,
                    timestamp: new Date(rm.timestamp),
                    metadata: rm.metadata,
                })),
            }));
            replaceAllConversations(updatedLocalConversations, 'sync');

            // --- End of Conversations Sync Logic ---

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
    }, [
        settings.googleDriveAccessToken,
        memories,
        replaceAllMemories,
        conversations, // ADDED
        replaceAllConversations, // ADDED
        setGoogleDriveSyncStatus,
        updateGoogleDriveLastSync,
        setGoogleDriveError
        // lastMemoryChangeSource and lastConversationChangeSource are not direct dependencies of syncDriveData itself,
        // but of the useEffect that calls it. The memories/conversations arrays are the data dependencies.
    ]);

    // Effect to trigger sync when memories or conversations change due to user/AI action
    useEffect(() => {
        let didTriggerSync = false;
        if (settings.googleDriveAccessToken && settings.googleDriveSyncStatus !== 'Syncing') {
            if (lastMemoryChangeSource === 'user') {
                console.log("Memories changed by user/AI, triggering Google Drive sync via hook.");
                didTriggerSync = true;
                syncDriveData().catch(error => {
                    console.error("Google Drive sync failed after memory change (hook):", error);
                }).finally(() => {
                    resetLastMemoryChangeSource();
                });
            }

            // Only check conversations if memories didn't trigger to avoid double sync from one action
            if (!didTriggerSync && lastConversationChangeSource === 'user') {
                console.log("Conversations changed by user/AI, triggering Google Drive sync via hook.");
                // didTriggerSync = true; // Not strictly needed for the last check
                syncDriveData().catch(error => {
                    console.error("Google Drive sync failed after conversation change (hook):", error);
                }).finally(() => {
                    resetLastConversationChangeSource();
                });
            }
        }

        // If not connected or sync already in progress, but flags are set, reset them to prevent stale triggers.
        // This handles cases where a change happens offline and then user connects.
        // The sync on connect (if implemented, e.g. manual or on app load) should handle the actual data.
        // Or, if flags are not reset, the next time token is available, this effect will run.
        // For now, let's reset if they were 'user' and no sync was triggered by this effect instance.
        if (!didTriggerSync) {
            if (lastMemoryChangeSource === 'user') {
                 resetLastMemoryChangeSource();
            }
            if (lastConversationChangeSource === 'user') {
                 resetLastConversationChangeSource();
            }
        }

    }, [
        settings.googleDriveAccessToken,
        settings.googleDriveSyncStatus,
        syncDriveData, // The memoized sync function
        lastMemoryChangeSource,
        resetLastMemoryChangeSource,
        lastConversationChangeSource,
        resetLastConversationChangeSource,
        // Do not add `memories` or `conversations` here, as `syncDriveData` already depends on them.
        // This effect is about *when* to call `syncDriveData` based on change *source flags*.
    ]);

    return { syncDriveData };
};
