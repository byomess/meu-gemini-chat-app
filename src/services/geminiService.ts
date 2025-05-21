// src/services/geminiService.ts
import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
    type Part,
    type GenerateContentResponse,
    type FunctionDeclaration as GeminiFunctionDeclaration,
    type Schema as GeminiSchema,
    Type as GeminiType,
    type GenerateContentParameters,
    type FunctionCall,
} from "@google/genai";

import type {
    GeminiModelConfig,
    FunctionDeclaration as AppFunctionDeclaration,
    SafetySetting,
    ProcessingStatus,
    ProcessingType,
    // ProcessingStage // Not directly used here, but part of ProcessingStatus
} from '../types';

const FILE_STATE_ACTIVE = "ACTIVE";
const FILE_STATE_FAILED = "FAILED";
const USER_ROLE = "user";
const MODEL_ROLE = "model";
const FUNCTION_ROLE = "function";

export interface StreamedGeminiResponseChunk {
    delta?: string;
    finalText?: string;
    memoryOperations?: {
        action: 'create' | 'update' | 'delete_by_ai_suggestion';
        content?: string;
        targetMemoryContent?: string;
        idToUpdate?: string;
    }[];
    error?: string;
    isFinished: boolean;
    processingStatus?: ProcessingStatus;
    rawPartsForNextTurn?: Part[];
}

export interface RawFileAttachment {
    file: File;
}

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

// Helper Functions
function sanitizeGoogleResourceName(baseName: string): string {
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

const buildChatHistory = (
    priorConversationMessages: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[],
    globalMemories: string[]
): Content[] => {
    const history: Content[] = [];
    let memoriesTextSegment = "";
    if (globalMemories.length > 0) {
        memoriesTextSegment = `
  ---
  CONHECIMENTO PRÉVIO SOBRE O USUÁRIO (MEMÓRIAS ATUAIS E EXATAS):
  ${globalMemories.map((mem) => `- "${mem}"`).join("\n")}
  ---
  `;
    } else {
        memoriesTextSegment = "(Nenhuma memória global registrada no momento.)";
    }
    history.push({ role: USER_ROLE, parts: [{ text: memoriesTextSegment.trim() }] });
    history.push({ role: MODEL_ROLE, parts: [{ text: "Ok, entendi o conhecimento prévio." }] });

    priorConversationMessages.forEach(msg => {
        if (msg.parts) {
            history.push({
                role: msg.sender,
                parts: msg.parts
            });
        } else if (msg.text !== undefined) {
            history.push({
                role: msg.sender as 'user' | 'model', // Function role always has parts
                parts: [{ text: msg.text }]
            });
        }
    });
    return history;
};

const createMemoryRegex = /\[MEMORIZE:\s*"([^"]+)"\]/g;
const updateMemoryRegex = /\[UPDATE_MEMORY original:\s*"([^"]+)"\s*new:\s*"([^"]+)"\]/g;
const deleteMemoryRegex = /\[DELETE_MEMORY:\s*"([^"]+)"\]/g;

const parseMemoryOperations = (responseText: string): {
    cleanedResponse: string;
    operations: StreamedGeminiResponseChunk['memoryOperations'];
} => {
    const operations: NonNullable<StreamedGeminiResponseChunk['memoryOperations']> = [];
    let cleanedResponse = responseText;

    const updateMatches = Array.from(responseText.matchAll(updateMemoryRegex));
    updateMatches.forEach(match => {
        if (match[1] && match[2]) {
            operations.push({ action: 'update', targetMemoryContent: match[1].trim(), content: match[2].trim() });
        }
    });
    cleanedResponse = cleanedResponse.replace(updateMemoryRegex, "").trim();

    const deleteMatches = Array.from(cleanedResponse.matchAll(deleteMemoryRegex));
    deleteMatches.forEach(match => {
        if (match[1]) {
            operations.push({ action: 'delete_by_ai_suggestion', targetMemoryContent: match[1].trim() });
        }
    });
    cleanedResponse = cleanedResponse.replace(deleteMemoryRegex, "").trim();

    const createMatches = Array.from(cleanedResponse.matchAll(createMemoryRegex));
    createMatches.forEach(match => {
        if (match[1]) {
            operations.push({ action: 'create', content: match[1].trim() });
        }
    });
    cleanedResponse = cleanedResponse.replace(createMemoryRegex, "").trim();

    return { cleanedResponse, operations: operations.length > 0 ? operations : undefined };
};

async function _waitForFileActive(
    genAI: GoogleGenAI,
    fileNameFromAPI: string,
    abortSignal?: AbortSignal,
    maxRetries = 15,
    delayMs = 2000
): Promise<GeminiFileMetadata> { // Changed to throw on failure/timeout for clarity
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

function _parseFunctionParametersSchema(schemaString: string, functionName: string): GeminiSchema | undefined {
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

function _buildApiTools(
    webSearchEnabled?: boolean,
    functionDeclarations?: AppFunctionDeclaration[]
): { functionDeclarations: GeminiFunctionDeclaration[] }[] | { googleSearch: Record<string, never> }[] | undefined {
    if (webSearchEnabled) {
        return [{ googleSearch: {} }];
    }
    if (functionDeclarations && functionDeclarations.length > 0) {
        return [{
            functionDeclarations: functionDeclarations.map((fd): GeminiFunctionDeclaration => ({
                name: fd.name,
                description: fd.description,
                parameters: _parseFunctionParametersSchema(fd.parametersSchema, fd.name),
            }))
        }];
    }
    return undefined;
}

async function* _processUserAttachments(
    genAI: GoogleGenAI,
    attachedRawFiles: RawFileAttachment[],
    abortSignal?: AbortSignal,
): AsyncGenerator<StreamedGeminiResponseChunk, Part[], undefined> {
    const processedFileParts: Part[] = [];
    if (!attachedRawFiles || attachedRawFiles.length === 0) {
        return processedFileParts;
    }

    yield {
        delta: "Processando anexos do usuário... ",
        isFinished: false,
        processingStatus: { type: 'user_attachment_upload', stage: 'pending', details: 'Iniciando processamento de anexos...' }
    };

    let allFilesProcessedSuccessfully = true;

    for (const rawFileAttachment of attachedRawFiles) {
        if (abortSignal?.aborted) {
            yield { error: "Processamento de anexos abortado.", isFinished: true, processingStatus: { type: 'user_attachment_upload', stage: 'failed', error: 'Abortado pelo usuário' } };
            throw new DOMException("Processamento de anexos abortado.", "AbortError");
        }

        const file = rawFileAttachment.file;
        const originalFileName = file.name || `unnamed-file-${Date.now()}`;

        if (!file || !(typeof File !== "undefined" && file instanceof File || typeof Blob !== "undefined" && file instanceof Blob)) {
            yield { error: `Anexo inválido detectado: ${originalFileName}.`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'Tipo de arquivo inválido' } };
            allFilesProcessedSuccessfully = false;
            continue;
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
                yield { error: `Falha no upload de '${originalFileName}': ID ausente.`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'ID ausente da API após upload.' } };
                allFilesProcessedSuccessfully = false;
                continue;
            }

            yield {
                isFinished: false,
                processingStatus: { type: 'user_attachment_upload', stage: 'in_progress', name: originalFileName, details: 'Aguardando ativação do arquivo na API...' }
            };

            const activeFileMetadata = await _waitForFileActive(genAI, initialUploadMetadata.name, abortSignal);
            // No need to check abortSignal here, _waitForFileActive throws if aborted

            processedFileParts.push({
                fileData: { mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri },
            });
            yield {
                isFinished: false,
                processingStatus: { type: 'user_attachment_upload', stage: 'completed', name: originalFileName, details: 'Arquivo pronto para IA.' }
            };

        } catch (uploadError: unknown) {
            if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
                yield { error: "Processamento de anexos abortado.", isFinished: true, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'Abortado pelo usuário durante upload/verificação.' } };
                throw uploadError;
            }
            const errorMessage = uploadError instanceof Error ? uploadError.message : "Erro upload/verificação";
            yield { error: `Falha com arquivo '${originalFileName}': ${errorMessage}`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: errorMessage } };
            allFilesProcessedSuccessfully = false;
        }
    }

    const successfullyUploadedCount = processedFileParts.length;
    if (allFilesProcessedSuccessfully) {
        yield { delta: "Anexos do usuário processados. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'completed', details: 'Todos os anexos prontos para a IA.' } };
    } else if (successfullyUploadedCount > 0) {
        yield { delta: "Alguns anexos do usuário processados. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'completed', details: 'Alguns anexos prontos, outros falharam.' } };
    } else {
        yield { delta: "Falha ao processar anexos do usuário. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', details: 'Nenhum anexo pôde ser processado.' } };
    }
    return processedFileParts;
}

async function* _executeDeclaredFunctionAndProcessResult(
    genAI: GoogleGenAI,
    declaredFunction: AppFunctionDeclaration,
    funcArgs: Record<string, unknown>, // FunctionCall.args is { [key: string]: any; }
    abortSignal?: AbortSignal,
): AsyncGenerator<StreamedGeminiResponseChunk, { functionResponseContent: unknown; fileDataPartForUserContext?: Part }, undefined> {
    const funcName = declaredFunction.name;
    let functionResponseContent: unknown;
    let fileDataPartForUserContext: Part | undefined = undefined;

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
        } else { // For DELETE or other methods without body by default
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

            const processingTypeFileFromFunc: ProcessingType = 'file_from_function_processing'; // Explicit type
            yield {
                delta: `[Loox: Link de arquivo (${contentTypeHeader}) detectado. Processando '${downloadedFileName}'...]\n`,
                isFinished: false,
                processingStatus: { type: processingTypeFileFromFunc, stage: 'in_progress', name: downloadedFileName, details: `Fazendo upload de '${downloadedFileName}' para API Gemini...` }
            };

            const initialUploadResponse = await genAI.files.upload({
                file: fileBlob, config: { mimeType: actualMimeType, displayName: downloadedFileName, name: googleResourceNameForFuncFile }
            });
            const uploadedFileMetadata = initialUploadResponse as GeminiFileMetadata;

            if (!uploadedFileMetadata || !uploadedFileMetadata.name || !uploadedFileMetadata.uri) {
                throw new Error("Falha no upload do arquivo (função): Metadados ou URI ausentes.");
            }
            yield {
                isFinished: false,
                processingStatus: { type: processingTypeFileFromFunc, stage: 'in_progress', name: downloadedFileName, details: `Aguardando ativação de '${downloadedFileName}'...` }
            };

            const activeFileMetadata = await _waitForFileActive(genAI, uploadedFileMetadata.name, abortSignal);

            functionResponseContent = {
                status: "success",
                message: `Arquivo '${downloadedFileName}' (${actualMimeType}) obtido e disponibilizado com URI '${activeFileMetadata.uri}'. A IA deve agora usar este URI para analisar o arquivo.`,
                fileName: downloadedFileName, mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri,
            };
            fileDataPartForUserContext = { fileData: { mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri } };

            yield {
                delta: `[Loox: Arquivo '${downloadedFileName}' adicionado ao contexto. Aguardando IA processar...]\n`,
                isFinished: false,
                processingStatus: { type: processingTypeFileFromFunc, stage: 'awaiting_ai', name: downloadedFileName, details: 'Arquivo pronto e aguardando análise da IA.' }
            };
        } else if (contentTypeHeader.includes("application/json")) {
            functionResponseContent = await apiResponse.json();
            yield { delta: `[Loox: API JSON '${funcName}' respondeu.]\n`, isFinished: false };
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
    return { functionResponseContent, fileDataPartForUserContext };
}

function _handleGeminiApiError(error: unknown, modelName: string): string {
    let errorMessage = "Ocorreu um erro ao contatar a IA.";
    if (error instanceof Error) {
        const apiErrorMessage = error.message;
        errorMessage = `Erro da API: ${apiErrorMessage}`;
        if (apiErrorMessage.toLowerCase().includes("api key") || apiErrorMessage.toLowerCase().includes("permission denied")) {
            errorMessage = "Chave de API inválida ou não autorizada.";
        } else if (apiErrorMessage.toLowerCase().includes("model not found")) {
            errorMessage = `Modelo "${modelName}" não encontrado.`;
        } else if (apiErrorMessage.toLowerCase().includes("quota")) {
            errorMessage = `Erro de quota da API: ${apiErrorMessage}`;
        } else if (apiErrorMessage.toLowerCase().includes("user location is not supported")) {
            errorMessage = `Erro da API: Localização não suportada. ${apiErrorMessage}`;
        } else if (apiErrorMessage.toLowerCase().includes("safety settings")) {
            errorMessage = `Erro da API relacionado às configurações de segurança: ${apiErrorMessage}`;
        }
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        errorMessage = `Erro da API: ${(error as { message: string }).message}`;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    // Log detailed error server-side
    let detailedErrorForLog: string | object = "Detalhes do erro indisponíveis";
    if (error && typeof error === 'object' && 'toJSON' in error && typeof (error as { toJSON?: () => unknown }).toJSON === 'function') {
        if (typeof error === 'object' && error !== null && 'toJSON' in error && typeof (error as { toJSON?: unknown }).toJSON === 'function') {
            detailedErrorForLog = (error as { toJSON: () => unknown }).toJSON() as string | object;
        }
    } else if (error instanceof Error) {
        detailedErrorForLog = { name: error.name, message: error.message, stack: error.stack };
    } else if (typeof error === 'string') { detailedErrorForLog = error; }
    console.error("GEMINI_SERVICE: Erro ao chamar API Gemini (stream):", detailedErrorForLog);

    return errorMessage;
}


export async function* streamMessageToGemini(
    apiKey: string,
    conversationHistory: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[],
    currentUserMessageText: string,
    attachedRawFiles: RawFileAttachment[],
    globalMemoriesObjects: { id: string; content: string }[],
    modelConfig: GeminiModelConfig,
    systemInstructionString: string,
    functionDeclarations: AppFunctionDeclaration[],
    abortSignal?: AbortSignal,
    webSearchEnabled?: boolean,
): AsyncGenerator<StreamedGeminiResponseChunk, void, undefined> {
    if (!apiKey) {
        yield { error: "Chave de API não fornecida.", isFinished: true };
        return;
    }
    if (abortSignal?.aborted) {
        yield { error: "Operação abortada antes de iniciar.", isFinished: true };
        return;
    }

    const genAI = new GoogleGenAI({ apiKey: apiKey });
    const globalMemoriesContent = globalMemoriesObjects.map(mem => mem.content);
    const currentChatHistory: Content[] = buildChatHistory(conversationHistory, globalMemoriesContent);
    const initialUserParts: Part[] = [];

    try {
        // 1. Process User Attachments
        if (attachedRawFiles && attachedRawFiles.length > 0) {
            const userFileParts = yield* _processUserAttachments(genAI, attachedRawFiles, abortSignal);
            initialUserParts.push(...userFileParts);
        }

        // 2. Add current user text message
        if (currentUserMessageText.trim()) {
            initialUserParts.push({ text: currentUserMessageText.trim() });
        }

        // 3. Add initial user parts to history if any
        if (initialUserParts.length > 0) {
            currentChatHistory.push({ role: USER_ROLE, parts: initialUserParts });
        } else {
            const userMessagesInHistory = currentChatHistory.filter(
                c => c.role === USER_ROLE &&
                    (c.parts ?? []).some(p =>
                        (p.text && p.text.trim() !== "" && !p.text.startsWith("---") && !p.text.startsWith("(Nenhuma memória global")) ||
                        p.fileData || p.inlineData
                    )
            );
            if (userMessagesInHistory.length === 0 && !currentUserMessageText.trim() && (!attachedRawFiles || attachedRawFiles.length === 0)) {
                yield { error: "Nenhum conteúdo de usuário válido para enviar.", isFinished: true };
                return;
            }
        }

        // 4. Prepare API Configuration
        const safetySettingsForAPI: SafetySetting[] | undefined = modelConfig.safetySettings?.map(s => ({
            category: s.category as HarmCategory, threshold: s.threshold as HarmBlockThreshold,
        }));
        const systemInstructionForAPI: Part | undefined = systemInstructionString.trim()
            ? { text: systemInstructionString.trim() } : undefined;
        const generationConfig: GenerateContentConfig = {
            temperature: modelConfig.temperature, topK: modelConfig.topK === 0 ? undefined : modelConfig.topK,
            topP: modelConfig.topP, maxOutputTokens: modelConfig.maxOutputTokens,
        };

        let accumulatedTextForFinalResponse = "";
        let toolsForApiNextTurn = _buildApiTools(webSearchEnabled, functionDeclarations);

        // 5. Main interaction loop (handles potential function calls)
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (abortSignal?.aborted) {
                throw new DOMException("Aborted by user during API interaction", "AbortError");
            }

            const requestConfig: Omit<GenerateContentConfig, 'model' | 'contents'> = {
                ...generationConfig,
                ...(safetySettingsForAPI && { safetySettings: safetySettingsForAPI }),
                systemInstruction: systemInstructionForAPI,
                tools: toolsForApiNextTurn,
            };
            const requestPayloadForAPI: GenerateContentParameters = {
                model: modelConfig.model,
                contents: currentChatHistory,
                config: requestConfig
            };

            const streamResult: AsyncIterable<GenerateContentResponse> = await genAI.models.generateContentStream(requestPayloadForAPI);

            let modelResponsePartsAggregatedThisTurn: Part[] = [];
            let hasFunctionCallInThisTurn = false;
            let currentTurnTextDelta = "";
            let functionCallRequestStatusEmitted = false;

            for await (const chunk of streamResult) {
                if (abortSignal?.aborted) {
                    throw new DOMException("Aborted by user in service stream", "AbortError");
                }
                const candidate = chunk.candidates?.[0];
                if (!candidate || !candidate.content || !candidate.content.parts) continue;

                let chunkProcessingStatus: ProcessingStatus | undefined = undefined;

                for (const part of candidate.content.parts) {
                    modelResponsePartsAggregatedThisTurn.push(part);
                    if (part.functionCall) {
                        hasFunctionCallInThisTurn = true;
                        if (!functionCallRequestStatusEmitted) {
                            chunkProcessingStatus = {
                                type: 'function_call_request',
                                stage: 'pending',
                                name: part.functionCall.name,
                                details: `IA solicitou a função: ${part.functionCall.name}`
                            };
                            functionCallRequestStatusEmitted = true;
                        }
                    }
                    if (part.text) currentTurnTextDelta += part.text;
                }

                if (chunkProcessingStatus || currentTurnTextDelta) {
                    yield {
                        delta: currentTurnTextDelta || undefined,
                        isFinished: false,
                        processingStatus: chunkProcessingStatus
                    };
                    if (currentTurnTextDelta) accumulatedTextForFinalResponse += currentTurnTextDelta;
                    currentTurnTextDelta = "";
                }
            } // End of streamResult loop

            if (modelResponsePartsAggregatedThisTurn.length > 0) {
                currentChatHistory.push({ role: MODEL_ROLE, parts: modelResponsePartsAggregatedThisTurn });
                yield { isFinished: false, rawPartsForNextTurn: [...modelResponsePartsAggregatedThisTurn] };
            }

            if (hasFunctionCallInThisTurn) {
                const functionCallPartFound = modelResponsePartsAggregatedThisTurn.find(p => p.functionCall)?.functionCall as FunctionCall | undefined;

                if (functionCallPartFound) {
                    const { name: funcName, args: funcArgs } = functionCallPartFound;
                    const declaredFunction = functionDeclarations.find(df => df.name === funcName);

                    if (declaredFunction) {
                        const { functionResponseContent, fileDataPartForUserContext } = yield* _executeDeclaredFunctionAndProcessResult(
                            genAI, declaredFunction, funcArgs as Record<string, unknown>, abortSignal
                        );

                        currentChatHistory.push({
                            role: FUNCTION_ROLE, parts: [
                                { functionResponse: { name: funcName, response: { name: funcName, content: functionResponseContent } } }
                            ]
                        });

                        if (fileDataPartForUserContext) {
                            // Add file from function to context for AI to see
                            currentChatHistory.push({
                                role: USER_ROLE,
                                parts: [
                                    { text: `[Sistema: Arquivo '${(functionResponseContent as {fileName?:string})?.fileName || 'desconhecido'}' obtido pela função '${funcName}' e adicionado ao contexto para análise.]` },
                                    fileDataPartForUserContext
                                ]
                            });
                        }

                        yield {
                            isFinished: false,
                            processingStatus: { type: 'function_call_response', stage: 'awaiting_ai', name: funcName, details: 'Resposta da função enviada à IA para processamento.' }
                        };

                    } else { // Function not declared
                        currentChatHistory.push({
                            role: FUNCTION_ROLE, parts: [
                                { functionResponse: { name: funcName, response: { name: funcName, content: { status: "error", error_message: `Função '${funcName}' não encontrada no sistema.` } } } }
                            ]
                        });
                        yield {
                            delta: `\n[Loox: Função '${funcName}' não encontrada.]\n`,
                            isFinished: false,
                            processingStatus: { type: 'function_call_request', stage: 'failed', name: funcName, error: 'Função não declarada/encontrada no sistema.' }
                        };
                    }

                    // Prepare for next iteration (AI processes function response)
                    modelResponsePartsAggregatedThisTurn = [];
                    // accumulatedTextForFinalResponse is NOT reset here, as AI might continue its thought process.
                    toolsForApiNextTurn = _buildApiTools(webSearchEnabled, functionDeclarations);
                    functionCallRequestStatusEmitted = false;
                    continue; // Continue while loop for AI to process function response
                }
            }

            // If no function call, or function call processing did not 'continue' (e.g. malformed), finish.
            const { cleanedResponse, operations } = parseMemoryOperations(accumulatedTextForFinalResponse);
            yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };
            return;

        } // End of while(true) loop

    } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
            yield { error: "Resposta abortada pelo usuário.", isFinished: true };
            return;
        }
        const errorMessage = _handleGeminiApiError(error, modelConfig.model);
        yield { error: errorMessage, isFinished: true };
    }
}
