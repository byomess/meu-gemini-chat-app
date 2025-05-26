// src/services/googleDriveApiService.ts

// Declare gapi to avoid TypeScript errors if it's not globally defined
declare const gapi: any;

const APP_FOLDER_NAME = "Loox";
const MEMORIES_FILE_NAME = "loox_memories.json";

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
 * Finds the ID of the memories JSON file within the specified folder.
 * @param parentFolderId The ID of the parent folder (e.g., the 'Loox' app folder).
 * @returns The ID of the memories file, or null if not found.
 */
export const getMemoriesFileId = async (parentFolderId: string): Promise<string | null> => {
    await ensureGapiClientReady();
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${MEMORIES_FILE_NAME}' and mimeType='application/json' and '${parentFolderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime)', // Request name and modifiedTime for debugging
        });

        console.log(`[getMemoriesFileId] Search for '${MEMORIES_FILE_NAME}' in folder '${parentFolderId}' result:`, response.result.files);

        if (response.result.files && response.result.files.length > 0) {
            if (response.result.files.length > 1) {
                console.warn(`[getMemoriesFileId] Found multiple files named '${MEMORIES_FILE_NAME}'. Returning the first one.`, response.result.files);
                // Consider adding logic here to delete duplicates or pick the latest modified one
            }
            return response.result.files[0].id;
        }
        return null;
    }
    catch (error: any) {
        console.error("Error getting memories file ID:", error);
        if (error && error.status === 401) {
            throw new Error(`Falha de autenticação ao buscar ID do arquivo de memórias no Drive (401).`);
        }
        throw new Error(`Falha ao buscar ID do arquivo de memórias no Drive: ${error instanceof Error ? error.message : String(error)}`);
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
 * Uploads or updates the memories JSON file.
 * @param content The JSON content to upload as a string.
 * @param parentFolderId The ID of the parent folder.
 * @param existingFileId The ID of the existing file to update, or null to create a new one.
 * @returns The ID of the uploaded/updated file.
 */
export const uploadFileContent = async (content: string, parentFolderId: string, existingFileId: string | null): Promise<string> => {
    await ensureGapiClientReady();

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delimiter = "\r\n--" + boundary + "--";

    // Base metadata for the file
    const baseMetadata: { name: string; mimeType: string; parents?: string[] } = {
        name: MEMORIES_FILE_NAME,
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
