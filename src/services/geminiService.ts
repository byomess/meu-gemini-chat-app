// src/services/geminiService.ts
import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
    type Part,
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
    currentSystemInstruction: string,
    globalMemories: string[]
): Content[] => {
    const history: Content[] = [];
    let initialSystemBlock = "";

    if (currentSystemInstruction) {
        initialSystemBlock += currentSystemInstruction;
    }

    let memoriesTextSegment = "";
    if (globalMemories.length > 0) {
        memoriesTextSegment = `
  ---
  CONHECIMENTO PRÉVIO SOBRE O USUÁRIO (MEMÓRIAS ATUAIS E EXATAS):
  ${globalMemories.map((mem, index) => `Memória ${index + 1}: "${mem}"`).join("\n")}
  ---
  (Instruções sobre como usar as memórias...)
  \n`;
    } else {
        memoriesTextSegment = "\n(Nenhuma memória global registrada no momento.)\n";
    }

    if (initialSystemBlock.includes("MEMÓRIAS GLOBAIS:")) {
        initialSystemBlock = initialSystemBlock.replace(
            "MEMÓRIAS GLOBAIS:",
            `MEMÓRIAS GLOBAIS:${memoriesTextSegment}`
        );
    } else {
        initialSystemBlock = (initialSystemBlock ? initialSystemBlock + "\n" : "") + memoriesTextSegment;
    }
    
    if (initialSystemBlock.trim()) {
        history.push({ role: "user", parts: [{ text: initialSystemBlock.trim() }] });
        history.push({ role: "model", parts: [{ text: "Ok." }] }); 
    }

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
             operations.push({
                 action: 'update',
                 targetMemoryContent: match[1].trim(),
                 content: match[2].trim(),
             });
         }
     });
    cleanedResponse = cleanedResponse.replace(updateMemoryRegex, "").trim();

     const deleteMatches = Array.from(cleanedResponse.matchAll(deleteMemoryRegex));
     deleteMatches.forEach(match => {
         if (match[1]) {
             operations.push({
                 action: 'delete_by_ai_suggestion',
                 targetMemoryContent: match[1].trim()
             });
         }
     });
    cleanedResponse = cleanedResponse.replace(deleteMemoryRegex, "").trim();

    const createMatches = Array.from(cleanedResponse.matchAll(createMemoryRegex));
     createMatches.forEach(match => {
         if (match[1]) {
             operations.push({
                 action: 'create',
                 content: match[1].trim()
             });
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
    // systemInstruction: string 
): AsyncGenerator<StreamedGeminiResponseChunk, void, undefined> {
    if (!apiKey) {
        yield { error: "Chave de API não fornecida.", isFinished: true };
        return;
    }

    const genAI = new GoogleGenAI({
        apiKey: apiKey
    });
    const globalMemoriesContent = globalMemoriesObjects.map(mem => mem.content);

    const baseHistory = buildChatHistory(
        conversationHistory,
        "", // Provide an empty string or the appropriate system instruction
        globalMemoriesContent
    );

    const currentUserParts: Part[] = [];
    if (currentUserMessageText.trim()) {
        currentUserParts.push({ text: currentUserMessageText.trim() });
    }

    const supportedImageMimeTypes = [
        "image/png", "image/jpeg", "image/jpg", 
        "image/webp", "image/heic", "image/heif"
    ];

    for (const fileData of attachedFileDataParts) {
        if (supportedImageMimeTypes.includes(fileData.mimeType.toLowerCase())) {
            currentUserParts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.data,
                },
            });
        } else {
            console.warn(`GEMINI_SERVICE: Tipo de arquivo '${fileData.mimeType}' não é suportado para envio direto.`);
        }
    }

    const chatHistoryForAPI: Content[] = [...baseHistory];
    if (currentUserParts.length > 0) {
        chatHistoryForAPI.push({
            role: "user",
            parts: currentUserParts,
        });
    } else {
        if (chatHistoryForAPI.length === 0 || (chatHistoryForAPI.length > 0 && chatHistoryForAPI[chatHistoryForAPI.length -1].role !== 'user')) {
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

    const apiGenerationConfig: GenerateContentConfig = {
        temperature: modelConfig.temperature,
        topK: modelConfig.topK === 0 ? undefined : modelConfig.topK, // TopK não pode ser 0 se topP for 1. undefined é melhor.
        topP: modelConfig.topP,
        maxOutputTokens: modelConfig.maxOutputTokens,
        safetySettings,
    };
    
    // Certifique-se de que topK e topP não sejam ambos 0, ou que topK não seja 0 se topP for 1.
    // A API do Gemini pode ter regras específicas. A SDK geralmente lida com isso,
    // mas para `topK: 0` é mais seguro omitir se `topP` está presente.
    if (apiGenerationConfig.topK === undefined && apiGenerationConfig.topP === undefined) {
        // Se ambos forem undefined (por ex, topK era 0 e topP não foi setado ou 0),
        // a API pode usar defaults, ou pode ser bom setar um topK padrão aqui.
        // Por agora, vamos deixar a API decidir.
    }


    try {
        const result = await genAI.models.generateContentStream({
            contents: chatHistoryForAPI,
            model: modelConfig.model,
            config: apiGenerationConfig,
        });
        
        let accumulatedText = "";
        const stream = result;

        for await (const chunk of stream) {
            const textFromChunk = chunk?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (textFromChunk) {
                accumulatedText += textFromChunk;
                yield { delta: textFromChunk, isFinished: false };
            }
        }

        const { cleanedResponse, operations } = parseMemoryOperations(accumulatedText);
        yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };

    } catch (error: unknown) {
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
            }
        }
        yield { error: errorMessage, isFinished: true };
    }
}