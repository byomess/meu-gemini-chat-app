// src/services/googleDriveApiService.ts

// Declare gapi to avoid TypeScript errors if it's not globally defined
declare const gapi: any;

const APP_FOLDER_NAME = "Loox";
export const MEMORIES_FILE_NAME = "loox_memories.json"; // EXPORTED
export const CONVERSATIONS_FILE_NAME = "loox_conversations.json"; // EXPORTED & ADDED

let gapiClientInitialized = false;

/**
 * Loads the Google API client library and initializes it.
 * This should be called once when the app starts or when a user connects to Google Drive.
 * @param accessToken The user's Google OAuth 2.0 access token.
 * @param scope The scope used for authentication (e.g., 'https://www.googleapis.com/auth/drive.file').
 */
export const loadAndInitGapiClient = async (accessToken: string, scope: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (gapiClientInitialized) {
            // If already initialized, just update the token if it's different.
            if (gapi.client.getToken()?.access_token !== accessToken) {
                gapi.client.setToken({ access_token: accessToken });
            }
            resolve();
            return;
        }

        // Check if gapi script is already loaded
        if (typeof gapi === 'undefined' || !gapi.client) {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            // No apiKey or clientId needed here if we're immediately setting the token
                            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                            scope: scope, // Use the scope passed from auth
                        });
                        gapi.client.setToken({ access_token: accessToken });
                        gapiClientInitialized = true;
                        resolve();
                    } catch (error) {
                        console.error("Error initializing gapi client:", error);
                        reject(new Error(`Falha ao inicializar cliente GAPI: ${error instanceof Error ? error.message : String(error)}`));
                    }
                });
            };
            script.onerror = (error) => {
                console.error("Failed to load Google API script:", error);
                reject(new Error("Falha ao carregar script da API Google. Verifique sua conexão."));
            };
            document.body.appendChild(script);
        } else {
            // gapi script is loaded, but client might not be initialized
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                        scope: scope,
                    });
                    gapi.client.setToken({ access_token: accessToken });
                    gapiClientInitialized = true;
                    resolve();
                } catch (error) {
                    console.error("Error initializing gapi client (already loaded):", error);
                    reject(new Error(`Falha ao inicializar cliente GAPI (já carregado): ${error instanceof Error ? error.message : String(error)}`));
                }
            });
        }
    });
};

// Helper to ensure gapi client is ready before making requests
const ensureGapiClientReady = async (): Promise<void> => {
    if (!gapiClientInitialized) {
        throw new Error("Cliente da API Google não inicializado. Conecte-se ao Google Drive primeiro.");
    }
    // Ensure the drive API is loaded
    if (!gapi.client.drive) {
        try {
            await gapi.client.load('drive', 'v3');
        } catch (error) {
            console.error("Error loading Google Drive API:", error);
            throw new Error(`Falha ao carregar a API do Google Drive: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
};

/**
 * Finds the 'Loox' application folder in Google Drive or creates it if it doesn't exist.
 * @returns The ID of the 'Loox' folder.
 */
export const findOrCreateAppFolder = async (): Promise<string> => {
    await ensureGapiClientReady();
    const parentFolderId = 'root'; // Using 'root' for visible folder in My Drive

    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        if (response.result.files && response.result.files.length > 0) {
            console.log(`[findOrCreateAppFolder] Found existing folder: ${response.result.files[0].name} (ID: ${response.result.files[0].id})`);
            return response.result.files[0].id;
        } else {
            const createResponse = await gapi.client.drive.files.create({
                name: APP_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId],
                fields: 'id, name', // Request name in response for debugging
            });
            console.log(`[findOrCreateAppFolder] Created new folder: ${createResponse.result.name} (ID: ${createResponse.result.id})`);
            return createResponse.result.id!;
        }
    } catch (error: any) {
        console.error("Error finding or creating app folder:", error);
        if (error && error.status === 401) {
            throw new Error(`Falha de autenticação ao encontrar/criar pasta no Drive (401). Por favor, reconecte sua conta.`);
        }
        throw new Error(`Falha ao encontrar ou criar pasta do aplicativo no Drive: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Finds the ID of a file by its name within the specified folder.
 * If multiple files with the same name are found, it returns the ID of the most recently modified one
 * and deletes the older duplicates.
 * @param parentFolderId The ID of the parent folder (e.g., the 'Loox' app folder).
 * @param fileName The name of the file to find.
 * @returns The ID of the file, or null if not found.
 */
export const findFileIdByName = async (parentFolderId: string, fileName: string): Promise<string | null> => {
    await ensureGapiClientReady();
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${fileName}' and mimeType='application/json' and '${parentFolderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime)', // Request name and modifiedTime for sorting and debugging
        });

        if (response.result.files && response.result.files.length > 0) {
            // Sort files by modifiedTime in descending order (most recent first)
            const sortedFiles = response.result.files.sort((a: any, b: any) => {
                const dateA = new Date(a.modifiedTime).getTime();
                const dateB = new Date(b.modifiedTime).getTime();
                return dateB - dateA; // Descending order
            });

            const latestFile = sortedFiles[0];

            if (sortedFiles.length > 1) {
                console.warn(`[findFileIdByName] Found multiple files named '${fileName}'. Keeping the most recent one (ID: ${latestFile.id}) and deleting older duplicates.`);
                // Delete older duplicates
                for (let i = 1; i < sortedFiles.length; i++) {
                    const duplicateFile = sortedFiles[i];
                    try {
                        await deleteFile(duplicateFile.id);
                        console.log(`[findFileIdByName] Successfully deleted duplicate file: ${duplicateFile.name} (ID: ${duplicateFile.id})`);
                    } catch (deleteError) {
                        console.error(`[findFileIdByName] Failed to delete duplicate file: ${duplicateFile.name} (ID: ${duplicateFile.id})`, deleteError);
                    }
                }
            }
            return latestFile.id;
        }
        return null;
    }
    catch (error: any) {
        console.error(`Error getting file ID for "${fileName}":`, error);
        if (error && error.status === 401) {
            throw new Error(`Falha de autenticação ao buscar ID do arquivo "${fileName}" no Drive (401).`);
        }
        throw new Error(`Falha ao buscar ID do arquivo "${fileName}" no Drive: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Reads the content of the memories JSON file.
 * @param fileId The ID of the memories file.
 * @returns The content of the file as a string.
 */
export const readFileContent = async (fileId: string): Promise<string> => {
    await ensureGapiClientReady();
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media', // This is crucial to get the file content
        });
        return response.body as string;
    } catch (error: any) {
        console.error("Error reading file content:", error);
        if (error && error.status === 401) {
            throw new Error(`Falha de autenticação ao ler conteúdo do arquivo no Drive (401).`);
        }
        throw new Error(`Falha ao ler conteúdo do arquivo no Drive: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Uploads or updates a JSON file.
 * @param content The JSON content to upload as a string.
 * @param parentFolderId The ID of the parent folder.
 * @param existingFileId The ID of the existing file to update, or null to create a new one.
 * @param fileName The name of the file to upload/update.
 * @returns The ID of the uploaded/updated file.
 */
export const uploadFileContent = async (content: string, parentFolderId: string, existingFileId: string | null, fileName: string): Promise<string> => {
    await ensureGapiClientReady();

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delimiter = "\r\n--" + boundary + "--";

    // Base metadata for the file
    const baseMetadata: { name: string; mimeType: string; parents?: string[] } = {
        name: fileName, // MODIFIED
        mimeType: 'application/json',
    };

    // Add parents only if creating a new file
    if (!existingFileId) {
        baseMetadata.parents = [parentFolderId];
    }

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(baseMetadata) + // Use the conditionally constructed metadata
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        close_delimiter;

    console.log(`[uploadFileContent] Attempting to upload/update. existingFileId: ${existingFileId}, parentFolderId: ${parentFolderId}`);

    try {
        let response;
        if (existingFileId) {
            // Update existing file using multipart PATCH
            response = await gapi.client.request({
                path: `/upload/drive/v3/files/${existingFileId}`,
                method: 'PATCH',
                params: { uploadType: 'multipart' },
                headers: {
                    'Content-Type': 'multipart/related; boundary=' + boundary
                },
                body: multipartRequestBody
            });
            console.log(`[uploadFileContent] File updated. Response:`, response.result);
        } else {
            // Create new file using multipart POST
            response = await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: {
                    'Content-Type': 'multipart/related; boundary=' + boundary
                },
                body: multipartRequestBody
            });
            console.log(`[uploadFileContent] File created. Response:`, response.result);
        }
        return response.result.id!;
    } catch (error: any) {
        console.error("Error uploading file content:", error);
        if (error && error.status === 401) {
            throw new Error(`Falha de autenticação ao enviar/atualizar arquivo no Drive (401).`);
        }
        throw new Error(`Falha ao enviar/atualizar arquivo no Drive: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Gets the modified time of a file.
 * @param fileId The ID of the file.
 * @returns The modified time as an ISO 8601 string.
 */
export const getFileModifiedTime = async (fileId: string): Promise<string> => {
    await ensureGapiClientReady();
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'modifiedTime',
        });
        return response.result.modifiedTime!;
    } catch (error: any) {
        console.error("Error getting file modified time:", error);
        if (error && error.status === 401) {
            throw new Error(`Falha de autenticação ao obter data de modificação do arquivo no Drive (401).`);
        }
        throw new Error(`Falha ao obter data de modificação do arquivo no Drive: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Deletes a file by its ID.
 * @param fileId The ID of the file to delete.
 */
export const deleteFile = async (fileId: string): Promise<void> => {
    await ensureGapiClientReady();
    try {
        await gapi.client.drive.files.delete({
            fileId: fileId,
        });
        console.log(`[deleteFile] File with ID ${fileId} deleted successfully.`);
    } catch (error: any) {
        console.error(`Error deleting file with ID ${fileId}:`, error);
        let detailMessage = String(error);
        // Attempt to get a more specific message from GAPI error structure
        if (error && error.result && error.result.error && error.result.error.message) {
            detailMessage = error.result.error.message;
        } else if (error instanceof Error) {
            detailMessage = error.message;
        }

        if (error && error.status === 401) {
            // For 401, prioritize the authentication failure message
            throw new Error(`Falha de autenticação ao excluir arquivo no Drive (401). Detalhes: ${detailMessage}`);
        }
        // For other errors, use the extracted detailMessage
        throw new Error(`Falha ao excluir arquivo no Drive (ID: ${fileId}). Detalhes: ${detailMessage}`);
    }
};
