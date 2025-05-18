// src/services/geminiService.ts
import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
    type Part,
    type GenerateContentResponse,
    // FileMetadataResponse pode não ser exportado, vamos usar o tipo inferido ou um mais genérico.
    // A resposta de upload e get é geralmente o objeto de metadados do arquivo.
} from "@google/genai";

import type { GeminiModelConfig } from '../types';

// CONSULTE A DOCUMENTAÇÃO OFICIAL DO GEMINI PARA OS VALORES EXATOS DESTES ESTADOS!
const FILE_STATE_ACTIVE = "ACTIVE";
const FILE_STATE_PROCESSING = "PROCESSING";
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

// Tipagem para o objeto de metadados do arquivo retornado pela API
// Adapte conforme a estrutura real da resposta da SDK
interface GeminiFileMetadata {
    name: string; // Ex: "files/file-id"
    displayName?: string;
    mimeType: string;
    sizeBytes?: string | number; // Pode ser string ou number
    createTime?: string; // Formato de data ISO
    updateTime?: string; // Formato de data ISO
    expirationTime?: string; // Formato de data ISO
    sha256Hash?: string;
    uri: string; // O URI para referenciar o arquivo
    state?: string; // O estado do arquivo (ACTIVE, PROCESSING, FAILED)
    // Outras propriedades podem existir
}


const buildChatHistory = (
    priorConversationMessages: { sender: 'user' | 'ai'; text: string }[],
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
        history.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        });
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
            console.log(`GEMINI_SERVICE: Verificação de estado do arquivo '${fileNameFromAPI}' abortada.`);
            throw new DOMException("Aborted during file state check", "AbortError");
        }
        try {
            console.log(`GEMINI_SERVICE: Verificando estado do arquivo '${fileNameFromAPI}', tentativa ${i + 1}/${maxRetries}...`);
            const fileMetadata = await genAI.files.get({ name: fileNameFromAPI }) as GeminiFileMetadata;
            
            if (fileMetadata && fileMetadata.state) {
                 if (fileMetadata.state.toUpperCase() === FILE_STATE_ACTIVE) {
                    console.log(`GEMINI_SERVICE: Arquivo '${fileNameFromAPI}' está ATIVO.`);
                    return fileMetadata;
                } else if (fileMetadata.state.toUpperCase() === FILE_STATE_FAILED) {
                    console.error(`GEMINI_SERVICE: Arquivo '${fileNameFromAPI}' falhou no processamento (estado: ${fileMetadata.state}).`);
                    return null;
                } else if (fileMetadata.state.toUpperCase() !== FILE_STATE_PROCESSING) {
                     console.warn(`GEMINI_SERVICE: Arquivo '${fileNameFromAPI}' em estado inesperado: ${fileMetadata.state}. Continuando a verificar.`);
                }
            } else {
                console.warn(`GEMINI_SERVICE: Metadados do arquivo '${fileNameFromAPI}' inválidos ou estado ausente na tentativa ${i+1}. Resposta:`, fileMetadata);
            }

            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        } catch (error) {
            console.error(`GEMINI_SERVICE: Erro ao obter metadados do arquivo '${fileNameFromAPI}' na tentativa ${i+1}:`, error);
            if (abortSignal?.aborted) throw new DOMException("Aborted during file state check retry", "AbortError");
            if (i < maxRetries - 1) {
                 await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                return null;
            }
        }
    }
    console.warn(`GEMINI_SERVICE: Arquivo '${fileNameFromAPI}' não ficou ativo após ${maxRetries} tentativas.`);
    return null;
}

export async function* streamMessageToGemini(
    apiKey: string,
    conversationHistory: { sender: 'user' | 'ai'; text: string }[],
    currentUserMessageText: string,
    attachedRawFiles: RawFileAttachment[],
    globalMemoriesObjects: { id: string; content: string }[],
    modelConfig: GeminiModelConfig,
    systemInstructionString: string,
    abortSignal?: AbortSignal
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
    const baseHistory = buildChatHistory(conversationHistory, globalMemoriesContent);
    const currentUserParts: Part[] = [];

    if (currentUserMessageText.trim()) {
        currentUserParts.push({ text: currentUserMessageText.trim() });
    }

    const uploadedFileParts: Part[] = [];
    let someUploadsFailed = false;
    if (attachedRawFiles && attachedRawFiles.length > 0) {
        yield { delta: "Processando anexos... ", isFinished: false };

        for (const rawFileAttachment of attachedRawFiles) {
            if (abortSignal?.aborted) {
                yield { error: "Processamento de anexos abortado.", isFinished: true };
                return;
            }
            
            const file = rawFileAttachment.file;
            if (!file || !(typeof File !== "undefined" && file instanceof File || typeof Blob !== "undefined" && file instanceof Blob)) {
                console.warn(`GEMINI_SERVICE: Anexo inválido encontrado. Pulando.`);
                yield { error: `Anexo inválido detectado.`, isFinished: false };
                someUploadsFailed = true;
                continue;
            }

            const baseFileName = (file.name || `file-${Date.now()}`)
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-') // Replace invalid characters with dashes
                .replace(/^-+|-+$/g, '') // Remove leading or trailing dashes
                .substring(0, 20); // Ensure the base name is short enough to fit within the limit
            const fileNameForUpload = `${baseFileName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.substring(0, 40);

            try {
                console.log(`GEMINI_SERVICE: Iniciando upload de '${fileNameForUpload}' (tipo: ${file.type})...`);

                
                const initialUploadMetadata = await genAI.files.upload({
                    file: file,
                    config: {
                        mimeType: file.type,
                        displayName: fileNameForUpload,
                        name: fileNameForUpload
                    }
                }) as GeminiFileMetadata;

                if (!initialUploadMetadata || !initialUploadMetadata.name) {
                    console.error(`GEMINI_SERVICE: Upload de '${fileNameForUpload}' não retornou um nome/ID de arquivo válido. Resposta:`, initialUploadMetadata);
                    yield { error: `Falha no upload de '${fileNameForUpload}': ID do arquivo ausente.`, isFinished: false };
                    someUploadsFailed = true;
                    continue;
                }
                console.log(`GEMINI_SERVICE: Upload inicial de '${initialUploadMetadata.displayName || fileNameForUpload}' concluído. Name/ID: ${initialUploadMetadata.name}. Verificando estado...`);

                const activeFileMetadata = await waitForFileActive(genAI, initialUploadMetadata.name, abortSignal);

                if (abortSignal?.aborted) {
                    yield { error: "Verificação de estado de arquivo abortada.", isFinished: true };
                    return;
                }

                if (activeFileMetadata) {
                    console.log(`GEMINI_SERVICE: Arquivo '${activeFileMetadata.displayName || fileNameForUpload}' pronto para uso. URI: ${activeFileMetadata.uri}`);
                    uploadedFileParts.push({
                        fileData: {
                            mimeType: activeFileMetadata.mimeType,
                            fileUri: activeFileMetadata.uri,
                        },
                    });
                } else {
                    yield { error: `Arquivo '${fileNameForUpload}' não pôde ser ativado ou falhou no processamento.`, isFinished: false };
                    someUploadsFailed = true;
                }

            } catch (uploadError: unknown) {
                console.error(`GEMINI_SERVICE: Falha no processo de upload/verificação do arquivo '${fileNameForUpload}':`, uploadError);
                if (uploadError instanceof DOMException && uploadError.name === "AbortError") {
                     yield { error: "Processamento de anexos abortado pelo usuário.", isFinished: true };
                     return;
                }
                const errorMessage = uploadError instanceof Error ? uploadError.message : "Erro desconhecido durante o upload/verificação";
                yield { error: `Falha com arquivo '${fileNameForUpload}': ${errorMessage}`, isFinished: false };
                someUploadsFailed = true;
            }
        }
        currentUserParts.push(...uploadedFileParts);
        
        if (attachedRawFiles.length > 0) {
            if (uploadedFileParts.length === attachedRawFiles.length && !someUploadsFailed) {
                 yield { delta: "Anexos processados com sucesso... Aguardando resposta... ", isFinished: false };
            } else if (uploadedFileParts.length > 0) {
                 yield { delta: "Alguns anexos processados... Aguardando resposta... ", isFinished: false };
            } else {
                 yield { delta: "Falha ao processar todos os anexos... Aguardando resposta... ", isFinished: false };
            }
        }
    }

    const chatHistoryForAPI: Content[] = [...baseHistory];
    if (currentUserParts.length > 0) {
        chatHistoryForAPI.push({
            role: "user",
            parts: currentUserParts,
        });
    } else {
        const isHistoryEffectivelyEmptyForNewMessage =
            chatHistoryForAPI.length <= 2 &&
            (chatHistoryForAPI.length === 0 || chatHistoryForAPI[chatHistoryForAPI.length - 1].role !== 'user');
        if (isHistoryEffectivelyEmptyForNewMessage) {
            yield { error: "Nenhum conteúdo de usuário válido para enviar.", isFinished: true };
            return;
        }
    }

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const systemInstructionForAPI: Part | undefined = systemInstructionString.trim()
        ? { text: systemInstructionString.trim() }
        : undefined;

    const generationConfig: GenerateContentConfig = {
        temperature: modelConfig.temperature,
        topK: modelConfig.topK === 0 ? undefined : modelConfig.topK,
        topP: modelConfig.topP,
        maxOutputTokens: modelConfig.maxOutputTokens,
    };

    const requestPayloadForAPI = {
        model: modelConfig.model,
        generationConfig: generationConfig,
        safetySettings: safetySettings,
        systemInstruction: systemInstructionForAPI,
        contents: chatHistoryForAPI,
    };

    try {
        const streamResult: AsyncIterable<GenerateContentResponse> = await genAI.models.generateContentStream(requestPayloadForAPI);

        let accumulatedText = "";
        for await (const chunk of streamResult) {
            if (abortSignal?.aborted) {
                throw new DOMException("Aborted by user in service", "AbortError");
            }
            const textFromChunk = chunk?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (textFromChunk) {
                accumulatedText += textFromChunk;
                yield { delta: textFromChunk, isFinished: false };
            }
        }

        const { cleanedResponse, operations } = parseMemoryOperations(accumulatedText);
        yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };

    } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
            yield { error: "Resposta abortada pelo usuário.", isFinished: true };
            return;
        }
        
        let detailedErrorForLog: string | object = "Detalhes do erro indisponíveis";
        if (error && typeof error === 'object' && 'toJSON' in error && typeof (error as { toJSON: () => object }).toJSON === 'function') {
            detailedErrorForLog = (error as { toJSON: () => object }).toJSON();
        } else if (error instanceof Error) {
            detailedErrorForLog = { name: error.name, message: error.message, stack: error.stack };
        } else if (typeof error === 'string') {
            detailedErrorForLog = error;
        }
        console.error("Erro ao chamar API Gemini (stream):", detailedErrorForLog);

        let errorMessage = "Ocorreu um erro ao contatar a IA. Tente novamente mais tarde.";
        if (error instanceof Error && 'message' in error) {
            const apiErrorMessage = (error as Error).message;
            errorMessage = `Erro da API: ${apiErrorMessage}`;
            if (apiErrorMessage.toLowerCase().includes("api key") || apiErrorMessage.toLowerCase().includes("permission denied")) {
                errorMessage = "Chave de API inválida ou não autorizada. Verifique suas configurações.";
            } else if (apiErrorMessage.toLowerCase().includes("model not found")) {
                errorMessage = `Modelo "${modelConfig.model}" não encontrado ou não acessível. Verifique o nome do modelo.`;
            } else if (apiErrorMessage.toLowerCase().includes("quota")) {
                errorMessage = `Erro de quota da API. Você excedeu o limite de uso. Detalhes: ${apiErrorMessage}`;
            } else if (apiErrorMessage.toLowerCase().includes("user location is not supported")) {
                errorMessage = `Erro da API: A sua localização não é suportada para uso desta API. Detalhes: ${apiErrorMessage}`;
            }
        }
        yield { error: errorMessage, isFinished: true };
    }
}