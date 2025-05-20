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

import type { GeminiModelConfig, FunctionDeclaration as AppFunctionDeclaration, SafetySetting } from '../types'; // Adicionado SafetySetting

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
    const currentUserParts: Part[] = [];

    if (currentUserMessageText.trim()) {
        currentUserParts.push({ text: currentUserMessageText.trim() });
    }

    const uploadedFileParts: Part[] = [];
    if (attachedRawFiles && attachedRawFiles.length > 0) {
        yield { delta: "Processando anexos... ", isFinished: false };
        for (const rawFileAttachment of attachedRawFiles) {
            if (abortSignal?.aborted) {
                yield { error: "Processamento de anexos abortado.", isFinished: true };
                return;
            }
            const file = rawFileAttachment.file;
            if (!file || !(typeof File !== "undefined" && file instanceof File || typeof Blob !== "undefined" && file instanceof Blob)) {
                yield { error: `Anexo inválido detectado.`, isFinished: false };
                continue;
            }
            const baseFileName = (file.name || `file-${Date.now()}`)
                .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').substring(0, 20);
            const fileNameForUpload = `${baseFileName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.substring(0, 40);

            try {
                const initialUploadMetadata = await genAI.files.upload({
                    file: file,
                    config: { mimeType: file.type, displayName: fileNameForUpload, name: fileNameForUpload }
                }) as GeminiFileMetadata;

                if (!initialUploadMetadata || !initialUploadMetadata.name) {
                    yield { error: `Falha no upload de '${fileNameForUpload}': ID ausente.`, isFinished: false };
                    continue;
                }
                const activeFileMetadata = await waitForFileActive(genAI, initialUploadMetadata.name, abortSignal);

                if (abortSignal?.aborted) {
                    yield { error: "Verificação de estado de arquivo abortada.", isFinished: true }; return;
                }
                if (activeFileMetadata) {
                    uploadedFileParts.push({
                        fileData: { mimeType: activeFileMetadata.mimeType, fileUri: activeFileMetadata.uri },
                    });
                } else {
                    yield { error: `Arquivo '${fileNameForUpload}' não pôde ser ativado.`, isFinished: false };
                }
            } catch (uploadError: unknown) {
                if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
                    yield { error: "Processamento de anexos abortado.", isFinished: true }; return;
                }
                const errorMessage = uploadError instanceof Error ? uploadError.message : "Erro upload/verificação";
                yield { error: `Falha com arquivo '${fileNameForUpload}': ${errorMessage}`, isFinished: false };
            }
        }
        currentUserParts.push(...uploadedFileParts);
        if (attachedRawFiles.length > 0) {
            if (uploadedFileParts.length === attachedRawFiles.length && !uploadedFileParts.some(p => !p.fileData?.fileUri)) {
                yield { delta: "Anexos processados com sucesso... Aguardando resposta... ", isFinished: false };
            } else if (uploadedFileParts.length > 0) {
                yield { delta: "Alguns anexos processados... Aguardando resposta... ", isFinished: false };
            } else {
                yield { delta: "Falha ao processar todos os anexos... Aguardando resposta... ", isFinished: false };
            }
        }
    }

    if (currentUserParts.length > 0) {
        currentChatHistory.push({
            role: "user",
            parts: currentUserParts,
        });
    } else {
        // Verifica se há conteúdo de usuário válido na mensagem atual ou no histórico,
        // desconsiderando a mensagem inicial de memórias.
        const userMessagesInHistory = currentChatHistory.filter(
            c => c.role === 'user' &&
                (c.parts ?? []).some(p =>
                    (p.text && p.text.trim() !== "" && !p.text.startsWith("---") && !p.text.startsWith("(Nenhuma memória global")) || // Não é a mensagem de memória
                    p.fileData ||
                    p.inlineData
                )
        );
        if (userMessagesInHistory.length === 0 && !currentUserMessageText.trim() && attachedRawFiles.length === 0) {
            yield { error: "Nenhum conteúdo de usuário válido para enviar.", isFinished: true };
            return;
        }
    }

    // MODIFICAÇÃO PRINCIPAL AQUI: Usa os safetySettings do modelConfig
    // Se modelConfig.safetySettings não estiver definido, usa um array vazio (a API usará os defaults dela)
    // ou um default mais restritivo, se preferir. Aqui, estou priorizando o que vem da config.
    const safetySettingsForAPI: SafetySetting[] | undefined = modelConfig.safetySettings?.map(s => ({
        category: s.category as HarmCategory, // Cast para o tipo HarmCategory do SDK @google/genai
        threshold: s.threshold as HarmBlockThreshold, // Cast para o tipo HarmBlockThreshold do SDK @google/genai
    })) as SafetySetting[];


    const systemInstructionForAPI: Part | undefined = systemInstructionString.trim()
        ? { text: systemInstructionString.trim() }
        : undefined;

    const generationConfig: GenerateContentConfig = {
        temperature: modelConfig.temperature,
        topK: modelConfig.topK === 0 ? undefined : modelConfig.topK, // API espera undefined para topK=0
        topP: modelConfig.topP,
        maxOutputTokens: modelConfig.maxOutputTokens,
    };

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
                        parameters = { type: GeminiType.OBJECT, properties: {} }; // Fallback seguro
                    }
                    return {
                        name: fd.name,
                        description: fd.description,
                        parameters: parameters,
                    };
                })
            }]
            : undefined;

    let accumulatedTextForFinalResponse = "";

    try {
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

            for await (const chunk of streamResult) {
                if (abortSignal?.aborted) {
                    throw new DOMException("Aborted by user in service stream", "AbortError");
                }

                const candidate = chunk.candidates?.[0];
                if (!candidate || !candidate.content || !candidate.content.parts) continue;

                candidate.content.parts.forEach(part => {
                    modelResponsePartsAggregatedThisTurn.push(part);
                    if (part.functionCall) hasFunctionCallInThisTurn = true;
                    if (part.text) currentTurnTextDelta += part.text;
                });

                if (!hasFunctionCallInThisTurn && currentTurnTextDelta) {
                    yield { delta: currentTurnTextDelta, isFinished: false };
                    accumulatedTextForFinalResponse += currentTurnTextDelta;
                    currentTurnTextDelta = "";
                }
            }

            if (hasFunctionCallInThisTurn) {
                toolsForApiNextTurn = undefined;
                const finalFunctionCallPart = modelResponsePartsAggregatedThisTurn.find(p => p.functionCall);
                if (finalFunctionCallPart && finalFunctionCallPart.functionCall) {
                    const { name: funcName, args: funcArgs } = finalFunctionCallPart.functionCall;

                    const textBeforeFunctionCall = modelResponsePartsAggregatedThisTurn
                        .filter(p => p.text && !p.functionCall).map(p => p.text).join("");
                    if (textBeforeFunctionCall) {
                        yield { delta: textBeforeFunctionCall, isFinished: false };
                        accumulatedTextForFinalResponse += textBeforeFunctionCall;
                    }
                    yield { delta: `\n\n[Loox: Chamando API externa para a função '${funcName}'...]\n`, isFinished: false };
                    currentChatHistory.push({ role: "model", parts: modelResponsePartsAggregatedThisTurn });

                    let functionExecutionResultData: unknown;
                    const declaredFunction = functionDeclarations.find(df => df.name === funcName);

                    if (declaredFunction) {
                        try {
                            let targetUrl = declaredFunction.endpointUrl;
                            const requestOptions: RequestInit = {
                                method: declaredFunction.httpMethod,
                                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                                signal: abortSignal, // Passa o abortSignal para a chamada fetch
                            };

                            if (declaredFunction.httpMethod === 'GET') {
                                const queryParams = new URLSearchParams(funcArgs as Record<string, string>).toString();
                                if (queryParams) {
                                    targetUrl += (targetUrl.includes('?') ? '&' : '?') + queryParams;
                                }
                            } else if (['POST', 'PUT', 'PATCH'].includes(declaredFunction.httpMethod)) {
                                requestOptions.body = JSON.stringify(funcArgs);
                            }

                            const apiResponse = await fetch(targetUrl, requestOptions);

                            if (abortSignal?.aborted) throw new DOMException("Aborted during function call fetch", "AbortError");

                            if (!apiResponse.ok) {
                                let errorBody = `Erro HTTP: ${apiResponse.status} ${apiResponse.statusText}`;
                                try { const errJson = await apiResponse.json(); errorBody += ` - ${JSON.stringify(errJson)}`; } catch { /* no json body */ }
                                throw new Error(errorBody);
                            }

                            const contentType = apiResponse.headers.get("content-type");
                            if (contentType && contentType.includes("application/json")) {
                                functionExecutionResultData = await apiResponse.json();
                            } else {
                                functionExecutionResultData = await apiResponse.text();
                            }
                            yield { delta: `[Loox: API para '${funcName}' respondeu.]\n`, isFinished: false };
                        } catch (executionError: unknown) {
                            if (executionError instanceof DOMException && executionError.name === "AbortError") {
                                throw executionError; // Re-throw para ser pego pelo catch principal
                            }
                            functionExecutionResultData = {
                                status: "error",
                                error_message: `Erro ao chamar API para '${funcName}': ${executionError instanceof Error ? executionError.message : "Erro desconhecido na chamada da API externa."}`,
                            };
                            yield { delta: `\n[Loox: Erro ao chamar API para '${funcName}'.]\n`, isFinished: false };
                        }
                    } else {
                        functionExecutionResultData = {
                            status: "error",
                            error_message: `Função '${funcName}' solicitada pela IA, mas não encontrada nas declarações configuradas.`,
                        };
                        yield { delta: `\n[Loox: Função '${funcName}' não encontrada.]\n`, isFinished: false };
                    }

                    const functionResponsePart: Part = {
                        functionResponse: { name: funcName, response: { name: funcName, content: functionExecutionResultData } }
                    };
                    currentChatHistory.push({ role: "function", parts: [functionResponsePart] });
                    modelResponsePartsAggregatedThisTurn = [];
                    currentTurnTextDelta = "";
                } else { // Caso estranho: hasFunctionCallInThisTurn é true, mas não achou functionCall
                    const { cleanedResponse, operations } = parseMemoryOperations(accumulatedTextForFinalResponse);
                    yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };
                    return;
                }
            } else { // Não houve function call, finaliza o turno.
                const { cleanedResponse, operations } = parseMemoryOperations(accumulatedTextForFinalResponse);
                yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };
                return;
            }
        }

    } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
            yield { error: "Resposta abortada pelo usuário.", isFinished: true }; return;
        }
        let detailedErrorForLog: string | object = "Detalhes do erro indisponíveis";
        if (error && typeof error === 'object' && 'toJSON' in error && typeof (error as any).toJSON === 'function') {
            detailedErrorForLog = (error as any).toJSON();
        } else if (error instanceof Error) {
            detailedErrorForLog = { name: error.name, message: error.message, stack: error.stack };
        } else if (typeof error === 'string') { detailedErrorForLog = error; }
        console.error("GEMINI_SERVICE: Erro ao chamar API Gemini (stream):", detailedErrorForLog);

        let errorMessage = "Ocorreu um erro ao contatar a IA.";
        if (error instanceof Error && 'message' in error) {
            const apiErrorMessage = (error as any).message || (error as any).toString(); // Adicionado fallback para toString
            errorMessage = `Erro da API: ${apiErrorMessage}`;
            if (apiErrorMessage.toLowerCase().includes("api key") || apiErrorMessage.toLowerCase().includes("permission denied")) {
                errorMessage = "Chave de API inválida ou não autorizada.";
            } else if (apiErrorMessage.toLowerCase().includes("model not found")) {
                errorMessage = `Modelo "${modelConfig.model}" não encontrado.`;
            } else if (apiErrorMessage.toLowerCase().includes("quota")) {
                errorMessage = `Erro de quota da API: ${apiErrorMessage}`;
            } else if (apiErrorMessage.toLowerCase().includes("user location is not supported")) {
                errorMessage = `Erro da API: Localização não suportada. ${apiErrorMessage}`;
            } else if (apiErrorMessage.toLowerCase().includes("safety settings")) { // Erro específico de safety settings
                errorMessage = `Erro da API relacionado às configurações de segurança: ${apiErrorMessage}`;
            }
        }
        yield { error: errorMessage, isFinished: true };
    }
}
