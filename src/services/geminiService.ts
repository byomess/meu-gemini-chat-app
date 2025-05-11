// src/services/geminiService.ts
import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
    type Part, // Importar Part
} from "@google/genai";

// Certifique-se de que este modelo suporta entrada multimodal (texto e imagem)
// Modelos como "gemini-1.5-pro-latest" (ou "gemini-1.5-pro-preview-MMDD") ou "gemini-1.5-flash-latest" geralmente suportam.
const MODEL_NAME = "gemini-2.5-pro-preview-05-06"; // Verifique o nome do modelo mais recente e apropriado

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

// Interface para os dados do arquivo que este serviço espera.
// A conversão de File para base64 e a obtenção do mimeType devem ocorrer no chamador (MessageInput.tsx).
export interface FileDataPart {
    mimeType: string;
    data: string; // String de dados Base64
}

const buildChatHistory = (
    priorConversationMessages: { sender: 'user' | 'ai'; text: string }[],
    systemInstruction: string,
    globalMemories: string[]
): Content[] => {
    const history: Content[] = [];
    let initialSystemBlock = "";

    if (systemInstruction) {
        initialSystemBlock += systemInstruction;
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
        // Assume que mensagens históricas são apenas texto.
        // Se mensagens históricas pudessem ter imagens de forma estruturada,
        // a estrutura `msg` e esta parte precisariam ser adaptadas.
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
    let match;

    while ((match = updateMemoryRegex.exec(responseText)) !== null) {
        if (match[1] && match[2]) {
            operations.push({
                action: 'update',
                targetMemoryContent: match[1].trim(),
                content: match[2].trim(),
            });
        }
    }
    cleanedResponse = cleanedResponse.replace(updateMemoryRegex, "").trim();

    while ((match = deleteMemoryRegex.exec(cleanedResponse)) !== null) {
        if (match[1]) {
            operations.push({ action: 'delete_by_ai_suggestion', targetMemoryContent: match[1].trim() });
        }
    }
    cleanedResponse = cleanedResponse.replace(deleteMemoryRegex, "").trim();

    while ((match = createMemoryRegex.exec(cleanedResponse)) !== null) {
        if (match[1]) {
            operations.push({ action: 'create', content: match[1].trim() });
        }
    }
    cleanedResponse = cleanedResponse.replace(createMemoryRegex, "").trim();

    return { cleanedResponse, operations: operations.length > 0 ? operations : undefined };
};


export async function* streamMessageToGemini(
    apiKey: string,
    conversationHistory: { sender: 'user' | 'ai'; text: string }[], // Histórico ANTES da mensagem atual
    currentUserMessageText: string, // Texto da mensagem ATUAL
    attachedFileDataParts: FileDataPart[], // Arquivos da mensagem ATUAL, já convertidos (base64)
    globalMemoriesObjects: { id: string; content: string }[]
): AsyncGenerator<StreamedGeminiResponseChunk, void, undefined> {
    if (!apiKey) {
        yield { error: "Chave de API não fornecida.", isFinished: true };
        return;
    }

    const genAI = new GoogleGenAI({ apiKey });
    const globalMemoriesContent = globalMemoriesObjects.map(mem => mem.content);

    const systemInstruction = `
Você é um assistente de IA prestativo e amigável.
Se o usuário enviar imagens, você pode descrevê-las ou responder perguntas sobre elas. Se nenhuma imagem for enviada explicitamente com a mensagem atual, não mencione imagens.
Siga estas instruções RIGOROSAMENTE para gerenciar memórias sobre o usuário.

MEMÓRIAS GLOBAIS:
(Esta seção será preenchida com as memórias atuais do usuário, se houver.)

INSTRUÇÕES PARA GERENCIAR MEMÓRIAS (use estas tags ao FINAL da sua resposta, se aplicável):

1.  CRIAR NOVA MEMÓRIA: Se a ÚLTIMA MENSAGEM DO USUÁRIO (texto ou contexto de imagem) contiver uma informação nova, factual e relevante que precise ser lembrada para o futuro, use a tag:
    [MEMORIZE: "conteúdo da nova memória aqui"]
    Seja muito seletivo. Não memorize perguntas, comentários triviais, ou suas próprias respostas. Foco em fatos sobre o usuário ou suas preferências explícitas.

2.  ATUALIZAR MEMÓRIA EXISTENTE: Se a ÚLTIMA MENSAGEM DO USUÁRIO (texto ou contexto de imagem) corrigir ou atualizar diretamente uma memória listada no "CONHECIMENTO PRÉVIO", use a tag:
    [UPDATE_MEMORY original:"conteúdo EXATO da memória antiga como listada" new:"novo conteúdo completo para essa memória"]
    É CRUCIAL que o "conteúdo EXATO da memória antiga como listada" seja IDÊNTICO ao texto de uma das memórias fornecidas (sem o prefixo "Memória N:").

3.  REMOVER MEMÓRIA (Use com extrema cautela): Se uma memória se tornar completamente obsoleta ou irrelevante com base na ÚLTIMA MENSAGEM DO USUÁRIO (texto ou contexto de imagem), e não apenas precisar de uma atualização, você PODE sugerir sua remoção usando:
    [DELETE_MEMORY: "conteúdo EXATO da memória a ser removida como listada"]
    Esta ação deve ser rara. Prefira atualizar, se possível. Se não tiver certeza, pergunte ao usuário.

REGRAS IMPORTANTES:
-   As tags de memória ([MEMORIZE:...], [UPDATE_MEMORY:...], [DELETE_MEMORY:...]) DEVEM ser colocadas no final da sua resposta completa.
-   Essas tags NÃO DEVEM aparecer no texto visível ao usuário. Elas serão processadas internamente.
-   Se múltiplas operações de memória forem necessárias (ex: uma atualização e uma nova memória), liste cada tag separadamente, uma após a outra, no final.
-   Se NÃO houver NADA a memorizar, atualizar ou remover da ÚLTIMA MENSAGEM DO USUÁRIO, NÃO inclua NENHUMA dessas tags.
-   Sua resposta principal ao usuário deve ser natural, útil e direta. As operações de memória são uma funcionalidade de bastidor.
`;

    const baseHistory = buildChatHistory(
        conversationHistory,
        systemInstruction,
        globalMemoriesContent
    );

    const currentUserParts: Part[] = [];

    if (currentUserMessageText.trim()) {
        currentUserParts.push({ text: currentUserMessageText.trim() });
    }

    // Tipos de MIME de imagem suportados pela API Gemini para inlineData.
    // Consulte a documentação da API Gemini para a lista mais atualizada.
    const supportedImageMimeTypes = [
        "image/png", "image/jpeg", "image/jpg", 
        "image/webp", "image/heic", "image/heif"
        // "image/gif" // GIFs podem ser suportados, mas são frequentemente animados. Verificar documentação.
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
            console.warn(`GEMINI_SERVICE: Tipo de arquivo '${fileData.mimeType}' não é uma imagem suportada para envio direto. O arquivo não será enviado como inlineData.`);
            // A informação textual sobre o arquivo (nome) já deve estar em currentUserMessageText
            // se o MessageInput.tsx a adicionou.
        }
    }

    const chatHistoryForAPI: Content[] = [...baseHistory];

    if (currentUserParts.length > 0) {
        chatHistoryForAPI.push({
            role: "user",
            parts: currentUserParts,
        });
    } else {
        // Se não houver texto nem arquivos válidos para a mensagem atual do usuário,
        // e o histórico anterior não terminar com uma mensagem do usuário,
        // a API pode retornar um erro.
        // O `MessageInput.tsx` deve garantir que `canSubmit` previna chamadas vazias.
        if (chatHistoryForAPI.length === 0 || chatHistoryForAPI[chatHistoryForAPI.length -1].role !== 'user') {
             console.warn("GEMINI_SERVICE: Nenhuma parte de usuário válida para enviar e o histórico não termina com o usuário.");
             // É crucial que `contents` para `generateContentStream` termine com uma mensagem de 'user'.
             // Se `baseHistory` já contém o system prompt (user) e model (ok), e `currentUserParts` está vazio,
             // a última mensagem seria 'model', o que é inválido.
             // Esta situação deve ser prevenida pelo `MessageInput`.
             // Se `baseHistory` estiver vazio e `currentUserParts` também, não há o que enviar.
             yield { error: "Nenhum conteúdo de usuário válido para enviar (nem texto, nem arquivos suportados).", isFinished: true };
             return;
        }
    }
    
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const config: GenerateContentConfig = { // Renomeado para evitar conflito com 'config' no escopo
        temperature: 0.7,
        topK: 1,
        topP: 1,
        // maxOutputTokens: 8192,
        // maxOutputTokens: 16384,
        maxOutputTokens: 32768,
        safetySettings,
    };

    try {
        const result = await genAI.models.generateContentStream({
            model: MODEL_NAME,
            contents: chatHistoryForAPI,
            config: config,
        });

        let accumulatedText = "";
        for await (const chunk of result) {
            if (chunk?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const chunkText = chunk.candidates[0].content.parts[0].text;
                accumulatedText += chunkText;
                yield { delta: chunkText, isFinished: false };
            }
        }

        const { cleanedResponse, operations } = parseMemoryOperations(accumulatedText);
        console.log("GEMINI_SERVICE: Accumulated text from AI:", accumulatedText);
        console.log("GEMINI_SERVICE: Parsed operations:", operations);
        yield { finalText: cleanedResponse, memoryOperations: operations, isFinished: true };

    } catch (error: unknown) {
        console.error("Erro ao chamar API Gemini (stream):", error);
        let errorMessage = "Ocorreu um erro ao contatar a IA. Tente novamente mais tarde.";
        if (error instanceof Error) {
            errorMessage = `Erro da API: ${error.message}`;
            if (error.message.toLowerCase().includes("api key") || error.message.toLowerCase().includes("permission denied")) {
                errorMessage = "Chave de API inválida ou não autorizada. Verifique suas configurações.";
            } else if (error.message.toLowerCase().includes("model not found")) {
                errorMessage = `Modelo "${MODEL_NAME}" não encontrado ou não acessível. Verifique o nome do modelo.`;
            }
        }
        yield { error: errorMessage, isFinished: true };
    }
}