// src/services/geminiService.ts
import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
    type Part,
    // type GenerateContentRequest,
    // type GenerativeModel,
    type GenerateContentResponse,
} from "@google/genai";

import type { GeminiModelConfig } from '../types';

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

export interface FileDataPart {
    mimeType: string;
    data: string; 
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
  ${globalMemories.map((mem, index) => `Memória ${index + 1}: "${mem}"`).join("\n")}
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


export async function* streamMessageToGemini(
    apiKey: string,
    conversationHistory: { sender: 'user' | 'ai'; text: string }[],
    currentUserMessageText: string,
    attachedFileDataParts: FileDataPart[],
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

    const baseHistory = buildChatHistory(
        conversationHistory,
        globalMemoriesContent
    );

    const currentUserParts: Part[] = [];
    if (currentUserMessageText.trim()) {
        currentUserParts.push({ text: currentUserMessageText.trim() });
    }

    const supportedMimeTypesForGemini = [
        "image/png", "image/jpeg", "image/jpg",
        "image/webp", "image/heic", "image/heif",
        "audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac",
        "audio/webm" 
    ];

    for (const fileData of attachedFileDataParts) {
        const lowerMimeType = fileData.mimeType.toLowerCase();
        if (supportedMimeTypesForGemini.includes(lowerMimeType)) {
            currentUserParts.push({
                inlineData: {
                    mimeType: lowerMimeType,
                    data: fileData.data,
                },
            });
        } else {
            console.warn(`GEMINI_SERVICE: Tipo de arquivo '${fileData.mimeType}' (base: '${lowerMimeType}') não é diretamente suportado. Será ignorado.`);
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
            (chatHistoryForAPI.length === 0 || chatHistoryForAPI[chatHistoryForAPI.length -1].role !== 'user');

        if (isHistoryEffectivelyEmptyForNewMessage) {
             yield { error: "Nenhum conteúdo de usuário válido para enviar (após processamento de memórias e anexos).", isFinished: true };
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
    
    try {
        // const model: GenerativeModel = genAI.getGenerativeModel({
        //     model: modelConfig.model,
        //     generationConfig,
        //     safetySettings,
        //     systemInstruction: systemInstructionForAPI,
        // });

        // const request: GenerateContentRequest = {
        //     contents: chatHistoryForAPI,
        // };
        
        // const streamResult: AsyncIterable<GenerateContentResponse> = await model.generateContentStream(request);
        
        const streamResult: AsyncIterable<GenerateContentResponse> = await genAI.models.generateContentStream({
            model: modelConfig.model,
            config: {
                ...generationConfig,
                safetySettings,
                systemInstruction: systemInstructionForAPI,
            },
            contents: chatHistoryForAPI,
        });

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
        console.error("Erro ao chamar API Gemini (stream):", error);
        let errorMessage = "Ocorreu um erro ao contatar a IA. Tente novamente mais tarde.";
        if (error instanceof Error) {
            errorMessage = `Erro da API: ${error.message}`;
             if (error.message.toLowerCase().includes("api key") || error.message.toLowerCase().includes("permission denied")) {
                errorMessage = "Chave de API inválida ou não autorizada. Verifique suas configurações.";
            } else if (error.message.toLowerCase().includes("model not found")) {
                errorMessage = `Modelo "${modelConfig.model}" não encontrado ou não acessível. Verifique o nome do modelo.`;
            } else if (error.message.toLowerCase().includes("quota")) {
                errorMessage = `Erro de quota da API. Você excedeu o limite de uso. Detalhes: ${error.message}`;
            } else if (error.message.toLowerCase().includes("invalid argument") || error.message.toLowerCase().includes("bad request")) {
                 errorMessage = `Erro na requisição para a IA. Verifique os parâmetros e o conteúdo enviado. Detalhes: ${error.message}`;
            }  else if (error.message.toLowerCase().includes("user location is not supported")) {
                errorMessage = `Erro da API: A sua localização não é suportada para uso desta API. Detalhes: ${error.message}`;
            }
        }
        yield { error: errorMessage, isFinished: true };
    }
}