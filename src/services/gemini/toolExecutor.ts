import {
    GoogleGenAI,
    type FunctionDeclaration as GeminiFunctionDeclaration,
    type Schema as GeminiSchema,
    Type as GeminiType,
    type Part,
} from "@google/genai";

import type {
    FunctionDeclaration as AppFunctionDeclaration,
    ProcessingStatus,
    ProcessingType,
    AttachedFileInfo,
} from '../../types';

import { sanitizeGoogleResourceName, waitForFileActive } from './fileUploader';

/**
 * Parses a JSON schema string for function parameters into a GeminiSchema object.
 * Provides a fallback empty object schema if parsing fails.
 */
function parseFunctionParametersSchema(schemaString: string, functionName: string): GeminiSchema | undefined {
    if (!schemaString || schemaString.trim() === "") {
        return undefined;
    }
    try {
        return JSON.parse(schemaString) as GeminiSchema;
    } catch (e) {
        console.warn(`Erro ao parsear parametersSchema para função ${functionName}:`, e);
        return { type: GeminiType.OBJECT, properties: {} }; // Fallback
    }
}

/**
 * Builds the API tools configuration for the Gemini model,
 * either enabling Google Search or providing custom function declarations.
 */
export function buildApiTools(
    webSearchEnabled?: boolean,
    functionDeclarations?: AppFunctionDeclaration[],
    isIncognito: boolean = false // Added isIncognito parameter
): { functionDeclarations: GeminiFunctionDeclaration[] }[] | { googleSearch: Record<string, never> }[] | undefined {
    if (webSearchEnabled) {
        return [{ googleSearch: {} }];
    }
    if (functionDeclarations && functionDeclarations.length > 0) {
        // Filter out memory-related functions if in incognito mode
        const filteredFunctionDeclarations = isIncognito
            ? functionDeclarations.filter(fd => !['create_memory', 'update_memory', 'delete_memory'].includes(fd.name))
            : functionDeclarations;

        if (filteredFunctionDeclarations.length === 0) {
            return undefined; // No functions left after filtering
        }

        return [{
            functionDeclarations: filteredFunctionDeclarations.map((fd): GeminiFunctionDeclaration => ({
                name: fd.name,
                description: fd.description,
                parameters: parseFunctionParametersSchema(fd.parametersSchema, fd.name),
            }))
        }];
    }
    return undefined;
}

/**
 * Processes media (base64 or URL) found within a JSON response from a function call.
 * Converts media to Blob and creates AttachedFileInfo objects.
 */
async function processMediaFromFunctionResponseJson(
    genAI: GoogleGenAI,
    jsonResponse: Record<string, unknown>, // Changed from 'any' to 'Record<string, unknown>'
    funcName: string,
    abortSignal?: AbortSignal,
): Promise<AttachedFileInfo[]> {
    const attachedFiles: AttachedFileInfo[] = [];

    if (!jsonResponse || typeof jsonResponse !== 'object') {
        return attachedFiles;
    }

    const createAttachedFileInfo = async (blob: Blob, fileName: string, mimeType: string): Promise<AttachedFileInfo> => {
        const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
        return {
            id: crypto.randomUUID(),
            name: fileName,
            type: mimeType,
            size: blob.size,
            dataUrl: dataUrl,
        };
    };

    const base64MediaTypes = [
        { key: 'image_base64', mimePrefix: 'image/', defaultName: 'image' },
        { key: 'audio_base64', mimePrefix: 'audio/', defaultName: 'audio' },
        { key: 'video_base64', mimePrefix: 'video/', defaultName: 'video' },
    ];

    for (const mediaType of base64MediaTypes) {
        if (jsonResponse[mediaType.key] && typeof jsonResponse[mediaType.key] === 'string') {
            try {
                const base64Data = jsonResponse[mediaType.key] as string; // Added type assertion
                const mimeType = (jsonResponse[`${mediaType.key}_mime_type`] as string) || `${mediaType.mimePrefix}jpeg`; // Added type assertion
                const fileName = (jsonResponse[`${mediaType.key}_name`] as string) || `${mediaType.defaultName}_${funcName}_${Date.now()}.${mimeType.split('/')[1] || 'bin'}`; // Added type assertion

                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });

                attachedFiles.push(await createAttachedFileInfo(blob, fileName, mimeType));
            } catch (e) {
                console.error(`Failed to process base64 media from function '${funcName}':`, e);
            }
        }
    }

    if (jsonResponse.file_url && typeof jsonResponse.file_url === 'string' && jsonResponse.mime_type && typeof jsonResponse.mime_type === 'string') {
        try {
            const fileUrl = jsonResponse.file_url as string; // Added type assertion
            const mimeType = jsonResponse.mime_type as string; // Added type assertion
            const fileName = (jsonResponse.file_name as string) || `file_${funcName}_${Date.now()}.${mimeType.split('/')[1] || 'bin'}`; // Added type assertion

            const response = await fetch(fileUrl, { signal: abortSignal });
            if (!response.ok) throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
            const blob = await response.blob();

            attachedFiles.push(await createAttachedFileInfo(blob, fileName, mimeType));
        } catch (e) {
            console.error(`Failed to process file URL from function '${funcName}':`, e);
        }
    }

    return attachedFiles;
}

/**
 * Executes a declared function, processes its response (including direct files or embedded media),
 * and yields status updates. Returns the function response content and any file data parts.
 */
export async function* executeDeclaredFunctionAndProcessResult(
    genAI: GoogleGenAI,
    declaredFunction: AppFunctionDeclaration,
    funcArgs: Record<string, unknown>,
    abortSignal?: AbortSignal,
): AsyncGenerator<{ delta?: string; isFinished: boolean; processingStatus?: ProcessingStatus; functionAttachedFilesInfo?: AttachedFileInfo[] }, { functionResponseContent: unknown; fileDataPartForUserContext?: Part; attachedFilesFromFunction?: AttachedFileInfo[] }, undefined> {
    const funcName = declaredFunction.name;
    let functionResponseContent: unknown;
    let fileDataPartForUserContext = undefined;
    const attachedFilesFromFunction: AttachedFileInfo[] = [];

    yield {
        delta: `\n\n[Loox: Chamando '${funcName}'...]\n`,
        isFinished: false,
        processingStatus: { type: 'function_call_execution', stage: 'in_progress', name: funcName, details: 'Iniciando execução da função...' }
    };

    try {
        let targetUrl = declaredFunction.endpointUrl;
        const requestOptions: RequestInit = {
            method: declaredFunction.httpMethod,
            headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
            signal: abortSignal,
        };

        if (declaredFunction.httpMethod === 'GET') {
            const queryParams = new URLSearchParams(funcArgs as Record<string, string>).toString();
            if (queryParams) targetUrl += (targetUrl.includes('?') ? '&' : '?') + queryParams;
        } else if (['POST', 'PUT', 'PATCH'].includes(declaredFunction.httpMethod)) {
            requestOptions.body = JSON.stringify(funcArgs);
        } else {
            const headers = requestOptions.headers as Record<string, string>;
            delete headers['Content-Type'];
        }

        yield {
            isFinished: false,
            processingStatus: { type: 'function_call_execution', stage: 'in_progress', name: funcName, details: 'Contactando API externa...' }
        };

        const apiResponse = await fetch(targetUrl, requestOptions);
        if (abortSignal?.aborted) throw new DOMException("Aborted during function call fetch", "AbortError");

        if (!apiResponse.ok) {
            let errorBody = `Erro HTTP: ${apiResponse.status} ${apiResponse.statusText}`;
            try { const errJson = await apiResponse.json(); errorBody += ` - ${JSON.stringify(errJson)}`; } catch { /* no json body */ }
            throw new Error(errorBody);
        }
        yield {
            isFinished: false,
            processingStatus: { type: 'function_call_execution', stage: 'completed', name: funcName, details: 'Resposta da API externa recebida.' }
        };

        const contentTypeHeader = apiResponse.headers.get("content-type")?.toLowerCase() || "";
        const contentDispositionHeader = apiResponse.headers.get("content-disposition");
        const directFileMimeTypes = [
            "application/pdf", "text/plain", "text/markdown", "text/csv",
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
            "video/mp4", "video/webm", "video/quicktime"
        ];
        const isDirectFileLink = directFileMimeTypes.some(fileType => contentTypeHeader.startsWith(fileType));

        if (isDirectFileLink) {
            const fileBlob = await apiResponse.blob();
            const actualMimeType = fileBlob.type || contentTypeHeader;
            let downloadedFileName = "downloaded-file";
            if (contentDispositionHeader) {
                const filenameMatch = contentDispositionHeader.match(/filename\*?=['"]?([^'";]+)['"]?/);
                if (filenameMatch && filenameMatch[1]) downloadedFileName = decodeURIComponent(filenameMatch[1]);
            }
            if (downloadedFileName === "downloaded-file") {
                try { const urlPath = new URL(targetUrl).pathname; const lastSegment = urlPath.substring(urlPath.lastIndexOf('/') + 1); if (lastSegment) downloadedFileName = decodeURIComponent(lastSegment); } catch { /* ignore */ }
            }
            const downloadedFileBaseName = downloadedFileName.substring(0, downloadedFileName.lastIndexOf('.')) || downloadedFileName;
            const googleResourceNameForFuncFile = sanitizeGoogleResourceName(downloadedFileBaseName);

            const processingTypeFileFromFunc: ProcessingType = 'file_from_function_processing';
            yield {
                delta: `[Loox: Link de arquivo (${contentTypeHeader}) detectado. Processando '${downloadedFileName}'...]\n`,
                isFinished: false,
                processingStatus: { type: processingTypeFileFromFunc, stage: 'in_progress', name: downloadedFileName, details: `Fazendo upload de '${downloadedFileName}' para API Gemini...` }
            };

            const initialUploadResponse = await genAI.files.upload({
                file: fileBlob, config: { mimeType: actualMimeType, displayName: downloadedFileName, name: googleResourceNameForFuncFile }
            });
            const uploadedFileMetadata = initialUploadResponse as { name: string; uri: string; mimeType: string; };

            if (!uploadedFileMetadata || !uploadedFileMetadata.name || !uploadedFileMetadata.uri) {
                throw new Error("Falha no upload do arquivo (função): Metadados ou URI ausentes.");
            }
            yield {
                isFinished: false,
                processingStatus: { type: processingTypeFileFromFunc, stage: 'in_progress', name: downloadedFileName, details: `Aguardando ativação de '${downloadedFileName}'...` }
            };

            const activeFileMetadata = await waitForFileActive(genAI, uploadedFileMetadata.name, abortSignal);

            functionResponseContent = {
                status: "success",
                message: `Arquivo '${downloadedFileName}' (${actualMimeType}) obtido e disponibilizado com URI '${activeFileMetadata.uri}'. A IA deve agora usar este URI para analisar o arquivo.`,
                fileName: downloadedFileName, mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri,
            };
            fileDataPartForUserContext = { fileData: { mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri } };

            const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(fileBlob);
            });
            attachedFilesFromFunction.push({
                id: crypto.randomUUID(),
                name: downloadedFileName,
                type: actualMimeType,
                size: fileBlob.size,
                dataUrl: dataUrl,
            });

            yield {
                delta: `[Loox: Arquivo '${downloadedFileName}' adicionado ao contexto. Aguardando IA processar...]\n`,
                isFinished: false,
                processingStatus: { type: processingTypeFileFromFunc, stage: 'awaiting_ai', name: downloadedFileName, details: 'Arquivo pronto e aguardando análise da IA.' }
            };
        } else if (contentTypeHeader.includes("application/json")) {
            const jsonResponse = await apiResponse.json();
            functionResponseContent = jsonResponse;

            const mediaFromJsonResponse = await processMediaFromFunctionResponseJson(genAI, jsonResponse, funcName, abortSignal);
            if (mediaFromJsonResponse.length > 0) {
                attachedFilesFromFunction.push(...mediaFromJsonResponse);
                yield {
                    delta: `[Loox: Mídia detectada na resposta JSON da função '${funcName}'.]\n`,
                    isFinished: false,
                    functionAttachedFilesInfo: mediaFromJsonResponse,
                    processingStatus: { type: 'file_from_function_processing', stage: 'completed', details: 'Mídia da função processada.' }
                };
            } else {
                yield { delta: `[Loox: API JSON '${funcName}' respondeu.]\n`, isFinished: false };
            }
        } else {
            functionResponseContent = await apiResponse.text();
            yield { delta: `[Loox: API Texto '${funcName}' respondeu.]\n`, isFinished: false };
        }
    } catch (executionError: unknown) {
        if (executionError instanceof DOMException && executionError.name === "AbortError") throw executionError;
        const errorMsg = executionError instanceof Error ? executionError.message : "Erro desconhecido na execução da função.";
        functionResponseContent = { status: "error", error_message: `Erro ao executar a função '${funcName}': ${errorMsg}` };
        yield {
            delta: `\n[Loox: Erro com '${funcName}'.]\n`,
            isFinished: false,
            processingStatus: { type: 'function_call_execution', stage: 'failed', name: funcName, error: errorMsg }
        };
    }
    return { functionResponseContent, fileDataPartForUserContext, attachedFilesFromFunction };
}
