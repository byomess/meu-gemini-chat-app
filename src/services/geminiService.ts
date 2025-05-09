// src/services/geminiService.ts
import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
} from "@google/genai";

const MODEL_NAME = "gemini-2.5-pro-preview-05-06"; // ou o modelo que estiver usando

export interface StreamedGeminiResponseChunk {
    delta?: string;
    finalText?: string;
    memoryOperations?: {
        action: 'create' | 'update' | 'delete_by_ai_suggestion';
        content?: string;
        targetMemoryContent?: string;
        idToUpdate?: string; // Ainda não usado pela IA, mas mantido para futuro
    }[];
    error?: string;
    isFinished: boolean;
}

// src/services/geminiService.ts
const buildChatHistory = (
    conversationMessages: { sender: 'user' | 'ai'; text: string }[], // Este deve ser o histórico COMPLETO
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
    
    // Adiciona o bloco de sistema e a resposta curta do modelo
    if (initialSystemBlock.trim()) {
        history.push({ role: "user", parts: [{ text: initialSystemBlock.trim() }] });
        history.push({ role: "model", parts: [{ text: "Ok." }] }); // Resposta curta e neutra do modelo
    }

    // Adiciona o histórico de mensagens da conversa ATUAL (usuário e IA)
    conversationMessages.forEach(msg => {
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

    // Parse Updates primeiro
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

    // Parse Deletes (depois de updates)
    while ((match = deleteMemoryRegex.exec(cleanedResponse)) !== null) {
        if (match[1]) {
            operations.push({ action: 'delete_by_ai_suggestion', targetMemoryContent: match[1].trim() });
        }
    }
    cleanedResponse = cleanedResponse.replace(deleteMemoryRegex, "").trim();

    // Parse Creates por último
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
    conversationMessages: { sender: 'user' | 'ai'; text: string }[],
    currentUserMessageText: string,
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
Siga estas instruções RIGOROSAMENTE para gerenciar memórias sobre o usuário.

MEMÓRIAS GLOBAIS:
(Esta seção será preenchida com as memórias atuais do usuário, se houver.)

INSTRUÇÕES PARA GERENCIAR MEMÓRIAS (use estas tags ao FINAL da sua resposta, se aplicável):

1.  CRIAR NOVA MEMÓRIA: Se a ÚLTIMA MENSAGEM DO USUÁRIO contiver uma informação nova, factual e relevante que precise ser lembrada para o futuro, use a tag:
    [MEMORIZE: "conteúdo da nova memória aqui"]
    Seja muito seletivo. Não memorize perguntas, comentários triviais, ou suas próprias respostas. Foco em fatos sobre o usuário ou suas preferências explícitas.

2.  ATUALIZAR MEMÓRIA EXISTENTE: Se a ÚLTIMA MENSAGEM DO USUÁRIO corrigir ou atualizar diretamente uma memória listada no "CONHECIMENTO PRÉVIO", use a tag:
    [UPDATE_MEMORY original:"conteúdo EXATO da memória antiga como listada" new:"novo conteúdo completo para essa memória"]
    É CRUCIAL que o "conteúdo EXATO da memória antiga como listada" seja IDÊNTICO ao texto de uma das memórias fornecidas (sem o prefixo "Memória N:").

3.  REMOVER MEMÓRIA (Use com extrema cautela): Se uma memória se tornar completamente obsoleta ou irrelevante com base na ÚLTIMA MENSAGEM DO USUÁRIO, e não apenas precisar de uma atualização, você PODE sugerir sua remoção usando:
    [DELETE_MEMORY: "conteúdo EXATO da memória a ser removida como listada"]
    Esta ação deve ser rara. Prefira atualizar, se possível. Se não tiver certeza, pergunte ao usuário.

REGRAS IMPORTANTES:
-   As tags de memória ([MEMORIZE:...], [UPDATE_MEMORY:...], [DELETE_MEMORY:...]) DEVEM ser colocadas no final da sua resposta completa.
-   Essas tags NÃO DEVEM aparecer no texto visível ao usuário. Elas serão processadas internamente.
-   Se múltiplas operações de memória forem necessárias (ex: uma atualização e uma nova memória), liste cada tag separadamente, uma após a outra, no final.
-   Se NÃO houver NADA a memorizar, atualizar ou remover da ÚLTIMA MENSAGEM DO USUÁRIO, NÃO inclua NENHUMA dessas tags.
-   Sua resposta principal ao usuário deve ser natural, útil e direta. As operações de memória são uma funcionalidade de bastidor.

EXEMPLOS DE USO DAS TAGS DE MEMÓRIA:
(Suponha que o "CONHECIMENTO PRÉVIO" fornecido contenha: Memória 1: "O nome do tio do usuário é Carlos." e Memória 2: "A cor favorita do usuário é azul.")

Exemplo 1:
ÚLTIMA MENSAGEM DO USUÁRIO: "Na verdade, o nome do meu tio é Oscar."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [UPDATE_MEMORY original:"O nome do tio do usuário é Carlos." new:"O nome do tio do usuário é Oscar."]

Exemplo 2:
ÚLTIMA MENSAGEM DO USUÁRIO: "Eu gosto de jogar tênis aos sábados."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [MEMORIZE: "O usuário gosta de jogar tênis aos sábados."]

Exemplo 3:
ÚLTIMA MENSAGEM DO USUÁRIO: "Não gosto mais de azul, minha cor favorita agora é verde."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [UPDATE_MEMORY original:"A cor favorita do usuário é azul." new:"A cor favorita do usuário é verde."]

Exemplo 4:
ÚLTIMA MENSAGEM DO USUÁRIO: "Eu moro em São Paulo e meu hobby é cozinhar."
SUA RESPOSTA (final): ...sua resposta normal ao usuário... [MEMORIZE: "O usuário mora em São Paulo."][MEMORIZE: "O hobby do usuário é cozinhar."]

Exemplo 5 (Deleção):
(Suponha que o "CONHECIMENTO PRÉVIO" contenha: Memória 3: "O usuário tem um cachorro chamado Rex.")
ÚLTIMA MENSAGEM DO USUÁRIO: "Infelizmente, meu cachorro Rex faleceu semana passada."
SUA RESPOSTA (final): ...sua resposta normal ao usuário, expressando condolências... [DELETE_MEMORY: "O usuário tem um cachorro chamado Rex."]
`;

    const fullConversationHistoryForPrompt = [...conversationMessages, { sender: 'user' as 'user' | 'ai', text: currentUserMessageText }];

    const chatHistoryForAPI = buildChatHistory(
        fullConversationHistoryForPrompt,
        systemInstruction,
        globalMemoriesContent
    );

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const config: GenerateContentConfig = {
        temperature: 0.7,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192,
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