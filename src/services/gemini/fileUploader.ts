import { GoogleGenAI, type Part } from "@google/genai";
import type { ProcessingStatus } from '../../types';

// Constants for file states
const FILE_STATE_ACTIVE = "ACTIVE";
const FILE_STATE_FAILED = "FAILED";

// Internal type for Gemini file metadata
interface GeminiFileMetadata {
    name: string;
    displayName?: string;
    mimeType: string;
    sizeBytes?: string | number;
    createTime?: string;
    updateTime?: string;
    expirationTime?: string;
    sha256Hash?: string;
    uri: string;
    state?: string;
}

// Interface for raw file attachments
export interface RawFileAttachment {
    file: File;
}

/**
 * Sanitizes a base name to be suitable for Google resource names.
 * Converts to lowercase, replaces non-alphanumeric characters with hyphens,
 * removes leading/trailing hyphens, and adds a unique suffix.
 */
export function sanitizeGoogleResourceName(baseName: string): string {
    let sanitized = baseName;
    sanitized = sanitized.toLowerCase();
    sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');
    sanitized = sanitized.replace(/-+/g, '-');
    sanitized = sanitized.replace(/^-+|-+$/g, '');
    if (!sanitized) sanitized = 'file';
    sanitized = sanitized.substring(0, 20);
    const uniqueSuffix = `${Date.now().toString(36).substring(2, 7)}-${Math.random().toString(36).substring(2, 5)}`;
    let finalName = `${sanitized}-${uniqueSuffix}`;
    finalName = finalName.replace(/^-+|-+$/g, '');
    if (!finalName) finalName = `file-${uniqueSuffix}`;
    return finalName.substring(0, 40);
}

/**
 * Waits for a file uploaded to the Gemini API to become active.
 * Throws an error if the file fails to activate or if the operation is aborted.
 */
export async function waitForFileActive(
    genAI: GoogleGenAI,
    fileNameFromAPI: string,
    abortSignal?: AbortSignal,
    maxRetries = 15,
    delayMs = 2000
): Promise<GeminiFileMetadata> {
    for (let i = 0; i < maxRetries; i++) {
        if (abortSignal?.aborted) {
            throw new DOMException("Aborted during file state check", "AbortError");
        }
        try {
            const fileMetadata = await genAI.files.get({ name: fileNameFromAPI }) as GeminiFileMetadata;
            if (fileMetadata?.state?.toUpperCase() === FILE_STATE_ACTIVE) return fileMetadata;
            if (fileMetadata?.state?.toUpperCase() === FILE_STATE_FAILED) {
                console.warn(`File ${fileNameFromAPI} processing failed on API side.`);
                throw new Error(`File ${fileNameFromAPI} processing failed on API side.`);
            }
            if (i < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === "AbortError") throw error;
            console.warn(`Error checking file state for ${fileNameFromAPI}, retry ${i + 1}/${maxRetries}:`, error);
            if (i < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
            else throw new Error(`File ${fileNameFromAPI} did not become active after ${maxRetries} retries. Last error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(`File ${fileNameFromAPI} did not become active after ${maxRetries} retries.`);
}

/**
 * Processes a single user-attached raw file, uploads it to Gemini,
 * and yields status updates. Returns the Gemini Part for the file.
 */
export async function* processUserAttachment(
    genAI: GoogleGenAI,
    attachedRawFile: RawFileAttachment,
    abortSignal?: AbortSignal,
): AsyncGenerator<{ processingStatus?: ProcessingStatus; error?: string; isFinished: boolean }, Part, undefined> {
    const file = attachedRawFile.file;
    const originalFileName = file.name || `unnamed-file-${Date.now()}`;

    if (!file || !(typeof File !== "undefined" && file instanceof File || typeof Blob !== "undefined" && file instanceof Blob)) {
        yield { error: `Anexo inválido detectado: ${originalFileName}.`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'Tipo de arquivo inválido' } };
        throw new Error(`Anexo inválido detectado: ${originalFileName}.`);
    }

    const fileBaseName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
    const googleResourceName = sanitizeGoogleResourceName(fileBaseName);

    yield {
        isFinished: false,
        processingStatus: { type: 'user_attachment_upload', stage: 'in_progress', name: originalFileName, details: 'Enviando para API...' }
    };

    try {
        const initialUploadResponse = await genAI.files.upload({
            file: file, config: { mimeType: file.type, displayName: originalFileName, name: googleResourceName }
        });
        const initialUploadMetadata = initialUploadResponse as GeminiFileMetadata;

        if (!initialUploadMetadata || !initialUploadMetadata.name) {
            throw new Error(`Falha no upload de '${originalFileName}': ID ausente.`);
        }

        yield {
            isFinished: false,
            processingStatus: { type: 'user_attachment_upload', stage: 'in_progress', name: originalFileName, details: 'Aguardando ativação do arquivo na API...' }
        };

        const activeFileMetadata = await waitForFileActive(genAI, initialUploadMetadata.name, abortSignal);

        const filePart: Part = {
            fileData: { mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri },
        };
        yield {
            isFinished: false,
            processingStatus: { type: 'user_attachment_upload', stage: 'completed', name: originalFileName, details: 'Arquivo pronto para IA.' }
        };
        return filePart;
    } catch (uploadError: unknown) {
        if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
            yield { error: "Processamento de anexos abortado.", isFinished: true, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'Abortado pelo usuário durante upload/verificação.' } };
            throw uploadError;
        }
        const errorMessage = uploadError instanceof Error ? uploadError.message : "Erro upload/verificação";
        yield { error: `Falha com arquivo '${originalFileName}': ${errorMessage}`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: errorMessage } };
        throw new Error(`Falha com arquivo '${originalFileName}': ${errorMessage}`);
    }
}
