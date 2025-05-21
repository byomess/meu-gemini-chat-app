// src/services/geminiService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
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
} from "@google/genai";

import type {
    GeminiModelConfig,
    FunctionDeclaration as AppFunctionDeclaration,
    SafetySetting,
    ProcessingStatus,
    // ProcessingType,
    // ProcessingStage
} from '../types';

const FILE_STATE_ACTIVE = "ACTIVE";
const FILE_STATE_FAILED = "FAILED";

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
    history.push({ role: "user", parts: [{ text: memoriesTextSegment.trim() }] });
    history.push({ role: "model", parts: [{ text: "Ok, entendi o conhecimento prévio." }] });

    priorConversationMessages.forEach(msg => {
        if (msg.parts) {
            history.push({
                role: msg.sender as 'user' | 'model' | 'function',
                parts: msg.parts
            });
        } else if (msg.text !== undefined) {
            history.push({
                role: msg.sender as 'user' | 'model',
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

async function waitForFileActive(
    genAI: GoogleGenAI,
    fileNameFromAPI: string,
    abortSignal?: AbortSignal,
    maxRetries = 15,
    delayMs = 2000
): Promise<GeminiFileMetadata | null> {
    for (let i = 0; i < maxRetries; i++) {
        if (abortSignal?.aborted) {
            throw new DOMException("Aborted during file state check", "AbortError");
        }
        try {
            const fileMetadata = await genAI.files.get({ name: fileNameFromAPI }) as GeminiFileMetadata;
            if (fileMetadata?.state?.toUpperCase() === FILE_STATE_ACTIVE) return fileMetadata;
            if (fileMetadata?.state?.toUpperCase() === FILE_STATE_FAILED) {
                console.warn(`File ${fileNameFromAPI} processing failed on API side.`);
                return null;
            }
            if (i < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error: unknown) {
            console.warn(`Error checking file state for ${fileNameFromAPI}, retry ${i + 1}/${maxRetries}:`, error);
            if (abortSignal?.aborted) throw new DOMException("Aborted during file state check retry", "AbortError");
            if (i < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, delayMs)); else return null;
        }
    }
    console.warn(`File ${fileNameFromAPI} did not become active after ${maxRetries} retries.`);
    return null;
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

    if (currentUserMessageText.trim()) {
        initialUserParts.push({ text: currentUserMessageText.trim() });
    }

    if (attachedRawFiles && attachedRawFiles.length > 0) {
        yield {
            delta: "Processando anexos do usuário... ",
            isFinished: false,
            processingStatus: { type: 'user_attachment_upload', stage: 'pending', details: 'Iniciando processamento de anexos...' }
        };
        let allFilesProcessedSuccessfully = true;

        for (const rawFileAttachment of attachedRawFiles) {
            if (abortSignal?.aborted) {
                yield { error: "Processamento de anexos abortado.", isFinished: true, processingStatus: { type: 'user_attachment_upload', stage: 'failed', error: 'Abortado pelo usuário' } }; return;
            }
            const file = rawFileAttachment.file;
            if (!file || !(typeof File !== "undefined" && file instanceof File || typeof Blob !== "undefined" && file instanceof Blob)) {
                yield { error: `Anexo inválido detectado.`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: file?.name || 'desconhecido', error: 'Tipo de arquivo inválido' } };
                allFilesProcessedSuccessfully = false;
                continue;
            }
            const originalFileName = file.name || `unnamed-file-${Date.now()}`;
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

                const activeFileMetadata = await waitForFileActive(genAI, initialUploadMetadata.name, abortSignal);
                if (abortSignal?.aborted) {
                    yield { error: "Verificação de estado de arquivo abortada.", isFinished: true, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'Abortado durante verificação de estado.' } }; return;
                }

                if (activeFileMetadata) {
                    initialUserParts.push({
                        fileData: { mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri },
                    });
                    yield {
                        isFinished: false,
                        processingStatus: { type: 'user_attachment_upload', stage: 'completed', name: originalFileName, details: 'Arquivo pronto para IA.' }
                    };
                } else {
                    yield { error: `Arquivo '${originalFileName}' não pôde ser ativado.`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'Não foi possível ativar o arquivo na API.' } };
                    allFilesProcessedSuccessfully = false;
                }
            } catch (uploadError: unknown) {
                if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
                    yield { error: "Processamento de anexos abortado.", isFinished: true, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: 'Abortado pelo usuário durante upload/verificação.' } }; return;
                }
                const errorMessage = uploadError instanceof Error ? uploadError.message : "Erro upload/verificação";
                yield { error: `Falha com arquivo '${originalFileName}': ${errorMessage}`, isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', name: originalFileName, error: errorMessage } };
                allFilesProcessedSuccessfully = false;
            }
        }
        if (attachedRawFiles.length > 0) {
            const successfullyUploadedCount = initialUserParts.filter(p => p.fileData).length;
            if (allFilesProcessedSuccessfully) {
                yield { delta: "Anexos do usuário processados. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'completed', details: 'Todos os anexos prontos para a IA.' } };
            } else if (successfullyUploadedCount > 0) {
                yield { delta: "Alguns anexos do usuário processados. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'completed', details: 'Alguns anexos prontos, outros falharam.' } };
            } else {
                yield { delta: "Falha ao processar anexos do usuário. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', details: 'Nenhum anexo pôde ser processado.' } };
            }
        }
    }

    if (initialUserParts.length > 0) {
        currentChatHistory.push({ role: "user", parts: initialUserParts });
    } else {
        // Verifica se o último user message no histórico (que não seja o inicial de memória) tem conteúdo.
        // Isto é para evitar enviar uma "nova" mensagem de usuário vazia se a última já estava vazia.
        const userMessagesInHistory = currentChatHistory.filter(
            c => c.role === 'user' &&
                (c.parts ?? []).some(p =>
                    (p.text && p.text.trim() !== "" && !p.text.startsWith("---") && !p.text.startsWith("(Nenhuma memória global")) || // Não é a mensagem de memória e tem texto
                    p.fileData || p.inlineData // Ou tem arquivos/dados inline
                )
        );
        // Só envia erro se não há mensagens de usuário com conteúdo REAL no histórico,
        // E a mensagem atual do usuário (currentUserMessageText) está vazia, E não há anexos.
        if (userMessagesInHistory.length === 0 && !currentUserMessageText.trim() && attachedRawFiles.length === 0) {
            yield { error: "Nenhum conteúdo de usuário válido para enviar.", isFinished: true };
            return;
        }
    }

    const safetySettingsForAPI: SafetySetting[] | undefined = modelConfig.safetySettings?.map(s => ({
        category: s.category as HarmCategory, threshold: s.threshold as HarmBlockThreshold,
    })) as SafetySetting[];
    const systemInstructionForAPI: Part | undefined = systemInstructionString.trim()
        ? { text: systemInstructionString.trim() } : undefined;
    const generationConfig: GenerateContentConfig = {
        temperature: modelConfig.temperature, topK: modelConfig.topK === 0 ? undefined : modelConfig.topK,
        topP: modelConfig.topP, maxOutputTokens: modelConfig.maxOutputTokens,
    };

    let accumulatedTextForFinalResponse = "";
    let toolsForApiNextTurn = webSearchEnabled
        ? [{ googleSearch: {} }]
        : functionDeclarations.length > 0
            ? [{
                functionDeclarations: functionDeclarations.map((fd): GeminiFunctionDeclaration => {
                    let parameters: GeminiSchema | undefined = undefined;
                    try {
                        if (fd.parametersSchema && fd.parametersSchema.trim() !== "") {
                            parameters = JSON.parse(fd.parametersSchema) as GeminiSchema;
                        }
                    } catch (e) {
                        console.warn(`Erro ao parsear parametersSchema para função ${fd.name}:`, e);
                        parameters = { type: GeminiType.OBJECT, properties: {} }; // Fallback
                    }
                    return { name: fd.name, description: fd.description, parameters: parameters };
                })
            }]
            : undefined;

    try {
        while (true) { // Loop principal para permitir múltiplos turnos de IA (ex: após function call)
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
                contents: currentChatHistory, // Envia o histórico completo acumulado
                config: requestConfig
            };

            // Chama a API Gemini para gerar conteúdo
            const streamResult: AsyncIterable<GenerateContentResponse> = await genAI.models.generateContentStream(requestPayloadForAPI);

            let modelResponsePartsAggregatedThisTurn: Part[] = [];
            let hasFunctionCallInThisTurn = false;
            let currentTurnTextDelta = "";
            let functionCallRequestStatusEmitted = false; // Flag para emitir o status de 'function_call_request' apenas uma vez por turno de IA

            for await (const chunk of streamResult) {
                if (abortSignal?.aborted) {
                    throw new DOMException("Aborted by user in service stream", "AbortError");
                }
                const candidate = chunk.candidates?.[0];
                if (!candidate || !candidate.content || !candidate.content.parts) continue;

                let chunkProcessingStatus: ProcessingStatus | undefined = undefined;

                for (const part of candidate.content.parts) { // Loop pelas parts do chunk
                    modelResponsePartsAggregatedThisTurn.push(part); // Agrega todas as parts (texto, functionCall, etc.)
                    if (part.functionCall) {
                        hasFunctionCallInThisTurn = true;
                        if (!functionCallRequestStatusEmitted) { // Emitir status apenas uma vez
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

                // Envia o delta (texto e/ou status) para o cliente
                if (chunkProcessingStatus || currentTurnTextDelta) {
                    yield {
                        delta: currentTurnTextDelta || undefined, // Envia delta de texto se houver
                        isFinished: false,
                        processingStatus: chunkProcessingStatus // Envia status se houver
                    };
                    if (currentTurnTextDelta) accumulatedTextForFinalResponse += currentTurnTextDelta;
                    currentTurnTextDelta = ""; // Reseta o delta de texto após enviar
                }
            } // Fim do loop for-await (streamResult)

            // Após processar todos os chunks do stream atual da IA:
            if (modelResponsePartsAggregatedThisTurn.length > 0) {
                // Adiciona a resposta completa da IA (incluindo function calls) ao histórico do chat
                currentChatHistory.push({ role: "model", parts: modelResponsePartsAggregatedThisTurn });
                // Envia as parts cruas para o cliente, para que ele possa renderizar function calls/responses se necessário
                yield { isFinished: false, rawPartsForNextTurn: [...modelResponsePartsAggregatedThisTurn] };
            }

            if (hasFunctionCallInThisTurn) {
                // Encontra a primeira functionCall nas parts agregadas (geralmente haverá apenas uma por turno)
                const functionCallPartFound = modelResponsePartsAggregatedThisTurn.find(p => p.functionCall)?.functionCall; // Renomeada para evitar conflito

                if (functionCallPartFound) {
                    const { name: funcName, args: funcArgs } = functionCallPartFound;

                    // Informa o cliente que uma função está sendo chamada (para UI)
                    yield {
                        delta: `\n\n[Loox: Chamando '${funcName}'...]\n`, // Mensagem de log interna (será filtrada na UI)
                        isFinished: false,
                        processingStatus: { type: 'function_call_execution', stage: 'in_progress', name: funcName, details: 'Iniciando execução da função...' }
                    };

                    let functionExecutionResultData: unknown;
                    const declaredFunction = functionDeclarations.find(df => df.name === funcName);

                    if (declaredFunction) {
                        try {
                            // Prepara e executa a chamada HTTP para a função declarada
                            let targetUrl = declaredFunction.endpointUrl;
                            const requestOptions: RequestInit = {
                                method: declaredFunction.httpMethod,
                                headers: { 'Content-Type': 'application/json', 'Accept': '*/*' }, // Aceita qualquer coisa por padrão
                                signal: abortSignal, // Permite abortar a chamada fetch
                            };
                            if (declaredFunction.httpMethod === 'GET') {
                                const queryParams = new URLSearchParams(funcArgs as Record<string, string>).toString();
                                if (queryParams) targetUrl += (targetUrl.includes('?') ? '&' : '?') + queryParams;
                            } else if (['POST', 'PUT', 'PATCH'].includes(declaredFunction.httpMethod)) {
                                requestOptions.body = JSON.stringify(funcArgs);
                            } else { // Para DELETE ou outros métodos sem corpo padrão
                                delete (requestOptions.headers as any)['Content-Type'];
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
                            yield { // Sucesso inicial da chamada HTTP
                                isFinished: false,
                                processingStatus: { type: 'function_call_execution', stage: 'completed', name: funcName, details: 'Resposta da API externa recebida.' }
                            };

                            // Processa a resposta da função (pode ser JSON, texto ou um arquivo)
                            const contentTypeHeader = apiResponse.headers.get("content-type")?.toLowerCase() || "";
                            const contentDispositionHeader = apiResponse.headers.get("content-disposition");
                            const directFileMimeTypes = [ // Lista de MIME types que indicam um link direto para arquivo
                                "application/pdf", "text/plain", "text/markdown", "text/csv",
                                "image/jpeg", "image/png", "image/webp", "image/gif",
                                "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", // mp4 como audio é possível
                                "video/mp4", "video/webm", "video/quicktime"
                            ];
                            const isDirectFileLink = directFileMimeTypes.some(fileType => contentTypeHeader.startsWith(fileType));

                            if (isDirectFileLink) {
                                // Se for um arquivo, faz o download, upload para Gemini Files API e obtém URI
                                const fileBlob = await apiResponse.blob();
                                const actualMimeType = fileBlob.type || contentTypeHeader; // Confia no Blob.type primeiro
                                let downloadedFileName = "downloaded-file"; // Default
                                if (contentDispositionHeader) { // Tenta pegar do Content-Disposition
                                    const filenameMatch = contentDispositionHeader.match(/filename\*?=['"]?([^'";]+)['"]?/);
                                    if (filenameMatch && filenameMatch[1]) downloadedFileName = decodeURIComponent(filenameMatch[1]);
                                }
                                if (downloadedFileName === "downloaded-file") { // Tenta pegar do path da URL
                                    try { const urlPath = new URL(targetUrl).pathname; const lastSegment = urlPath.substring(urlPath.lastIndexOf('/') + 1); if (lastSegment) downloadedFileName = decodeURIComponent(lastSegment); } catch { /* ignore */ }
                                }
                                const downloadedFileBaseName = downloadedFileName.substring(0, downloadedFileName.lastIndexOf('.')) || downloadedFileName;
                                const googleResourceNameForFuncFile = sanitizeGoogleResourceName(downloadedFileBaseName);

                                yield { // Informa o cliente sobre o processamento do arquivo
                                    delta: `[Loox: Link de arquivo (${contentTypeHeader}) detectado. Processando '${downloadedFileName}'...]\n`,
                                    isFinished: false,
                                    processingStatus: { type: 'file_from_function_processing', stage: 'in_progress', name: downloadedFileName, details: `Fazendo upload de '${downloadedFileName}' para API Gemini...` }
                                };

                                // Upload para Gemini Files API
                                const initialUploadResponse = await genAI.files.upload({
                                    file: fileBlob, // Envia o Blob diretamente
                                    config: { mimeType: actualMimeType, displayName: downloadedFileName, name: googleResourceNameForFuncFile }
                                });
                                const uploadedFileMetadata = initialUploadResponse as GeminiFileMetadata;

                                if (!uploadedFileMetadata || !uploadedFileMetadata.name || !uploadedFileMetadata.uri) {
                                    throw new Error("Falha no upload do arquivo (função): Metadados ou URI ausentes.");
                                }
                                yield { // Aguardando ativação
                                    isFinished: false,
                                    processingStatus: { type: 'file_from_function_processing', stage: 'in_progress', name: downloadedFileName, details: `Aguardando ativação de '${downloadedFileName}'...` }
                                };

                                const activeFileMetadata = await waitForFileActive(genAI, uploadedFileMetadata.name, abortSignal);
                                if (abortSignal?.aborted) throw new DOMException("Verificação de estado (função) abortada.", "AbortError");

                                if (activeFileMetadata && activeFileMetadata.uri) {
                                    // Prepara os dados da resposta da função para a IA
                                    functionExecutionResultData = {
                                        status: "success",
                                        message: `Arquivo '${downloadedFileName}' (${actualMimeType}) obtido e disponibilizado com URI '${activeFileMetadata.uri}'. A IA deve agora usar este URI para analisar o arquivo.`,
                                        fileName: downloadedFileName, mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri,
                                    };
                                    // Adiciona uma mensagem de sistema E a referência ao arquivo no histórico para o próximo turno da IA
                                    currentChatHistory.push({
                                        role: "user", // Simula uma mensagem do usuário com o arquivo, para a IA "ver"
                                        parts: [
                                            { text: `[Sistema: Arquivo '${downloadedFileName}' obtido pela função '${funcName}' e adicionado ao contexto para análise.]` },
                                            { fileData: { mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri } }
                                        ]
                                    });
                                    yield { // Informa o cliente que o arquivo está pronto para a IA
                                        delta: `[Loox: Arquivo '${downloadedFileName}' adicionado ao contexto. Aguardando IA processar...]\n`,
                                        isFinished: false,
                                        processingStatus: { type: 'file_from_function_processing', stage: 'awaiting_ai', name: downloadedFileName, details: 'Arquivo pronto e aguardando análise da IA.' }
                                    };
                                } else {
                                    throw new Error(`Arquivo '${downloadedFileName}' (função) não ativado ou URI ausente.`);
                                }
                            } else if (contentTypeHeader.includes("application/json")) {
                                functionExecutionResultData = await apiResponse.json();
                                yield { delta: `[Loox: API JSON '${funcName}' respondeu.]\n`, isFinished: false };
                            } else { // Assume texto para outros tipos
                                functionExecutionResultData = await apiResponse.text();
                                yield { delta: `[Loox: API Texto '${funcName}' respondeu.]\n`, isFinished: false };
                            }
                        } catch (executionError: unknown) {
                            if (executionError instanceof DOMException && executionError.name === "AbortError") throw executionError; // Repassa abortos
                            const errorMsg = executionError instanceof Error ? executionError.message : "Erro desconhecido na execução da função.";
                            functionExecutionResultData = { status: "error", error_message: `Erro ao executar a função '${funcName}': ${errorMsg}` };
                            yield { // Informa o cliente sobre o erro na execução
                                delta: `\n[Loox: Erro com '${funcName}'.]\n`,
                                isFinished: false,
                                processingStatus: { type: 'function_call_execution', stage: 'failed', name: funcName, error: errorMsg }
                            };
                        }
                    } else { // Função não encontrada na declaração
                        functionExecutionResultData = { status: "error", error_message: `Função '${funcName}' não encontrada no sistema.` };
                        yield {
                            delta: `\n[Loox: Função '${funcName}' não encontrada.]\n`,
                            isFinished: false,
                            processingStatus: { type: 'function_call_request', stage: 'failed', name: funcName, error: 'Função não declarada/encontrada no sistema.' }
                        };
                    }

                    // Adiciona a resposta da função (ou erro) ao histórico do chat
                    currentChatHistory.push({
                        role: "function", parts: [
                            { functionResponse: { name: funcName, response: { name: funcName, content: functionExecutionResultData } } }
                        ]
                    });
                    yield { // Informa o cliente que a resposta da função está sendo enviada à IA
                        isFinished: false,
                        processingStatus: { type: 'function_call_response', stage: 'awaiting_ai', name: funcName, details: 'Resposta da função enviada à IA para processamento.' }
                    };

                    // ***** ESTA É A LINHA QUE FOI REMOVIDA *****
                    // accumulatedTextForFinalResponse = ""; // NÃO resetar o texto acumulado antes da function call

                    // Reseta as parts e o delta de texto para o próximo turno da IA
                    modelResponsePartsAggregatedThisTurn = [];
                    currentTurnTextDelta = "";
                    // Reconfigura as tools para o próximo turno (caso a IA queira chamar outra função ou a mesma novamente)
                    toolsForApiNextTurn = webSearchEnabled
                        ? [{ googleSearch: {} }]
                        : functionDeclarations.length > 0
                            ? [{
                                functionDeclarations: functionDeclarations.map((fd): GeminiFunctionDeclaration => {
                                    let params: GeminiSchema | undefined = undefined;
                                    try { if (fd.parametersSchema) params = JSON.parse(fd.parametersSchema) as GeminiSchema; } catch (e) { console.warn("Parse Error", e); params = { type: GeminiType.OBJECT, properties: {} }; }
                                    return { name: fd.name, description: fd.description, parameters: params };
                                })
                            }]
                            : undefined;
                    functionCallRequestStatusEmitted = false; // Reseta o flag para o próximo possível turno de IA
                    continue; // Volta para o início do loop `while(true)` para a IA processar a resposta da função
                } else {
                    // Este `else` corresponde a `if (functionCallPartFound)`.
                    // Se `hasFunctionCallInThisTurn` é true, mas `functionCallPartFound` é nulo (improvável se bem formado pela API),
                    // ou se a lógica anterior não continuou, terminamos.
                    const { cleanedResponse, operations } = parseMemoryOperations(accumulatedTextForFinalResponse);
                    yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };
                    return;
                }
            } else {
                // Se não houve function call neste turno, a resposta da IA está completa.
                const { cleanedResponse, operations } = parseMemoryOperations(accumulatedTextForFinalResponse);
                yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };
                return; // Termina o gerador
            }
        } // Fim do loop while(true)

    } catch (error: unknown) {
        // Tratamento de erro global para a função streamMessageToGemini
        if (error instanceof DOMException && error.name === "AbortError") {
            yield { error: "Resposta abortada pelo usuário.", isFinished: true }; return;
        }
        // Log detalhado do erro no servidor
        let detailedErrorForLog: string | object = "Detalhes do erro indisponíveis";
        if (error && typeof error === 'object' && 'toJSON' in error && typeof (error as any).toJSON === 'function') {
            detailedErrorForLog = (error as any).toJSON();
        } else if (error instanceof Error) {
            detailedErrorForLog = { name: error.name, message: error.message, stack: error.stack };
        } else if (typeof error === 'string') { detailedErrorForLog = error; }
        console.error("GEMINI_SERVICE: Erro ao chamar API Gemini (stream):", detailedErrorForLog);

        // Prepara uma mensagem de erro amigável para o cliente
        let errorMessage = "Ocorreu um erro ao contatar a IA.";
        if (error instanceof Error && 'message' in error) {
            const apiErrorMessage = (error as any).message || (error as any).toString();
            errorMessage = `Erro da API: ${apiErrorMessage}`;
            // Tenta fornecer mensagens mais específicas para erros comuns
            if (apiErrorMessage.toLowerCase().includes("api key") || apiErrorMessage.toLowerCase().includes("permission denied")) {
                errorMessage = "Chave de API inválida ou não autorizada.";
            } else if (apiErrorMessage.toLowerCase().includes("model not found")) {
                errorMessage = `Modelo "${modelConfig.model}" não encontrado.`;
            } else if (apiErrorMessage.toLowerCase().includes("quota")) {
                errorMessage = `Erro de quota da API: ${apiErrorMessage}`;
            } else if (apiErrorMessage.toLowerCase().includes("user location is not supported")) {
                errorMessage = `Erro da API: Localização não suportada. ${apiErrorMessage}`;
            } else if (apiErrorMessage.toLowerCase().includes("safety settings")) {
                errorMessage = `Erro da API relacionado às configurações de segurança: ${apiErrorMessage}`;
            }
        }
        yield { error: errorMessage, isFinished: true };
    }
}
