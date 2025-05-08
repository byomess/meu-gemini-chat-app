// src/services/geminiService.ts

import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
  } from "@google/genai";
  
  const MODEL_NAME = "gemini-2.0-flash-001";
  
  export interface StreamedGeminiResponseChunk {
    delta?: string;
    finalText?: string;
    newMemories?: string[];
    error?: string;
    isFinished: boolean;
  }
  
  const buildChatHistory = (
    conversationMessages: { sender: 'user' | 'ai'; text: string }[],
    systemInstruction: string,
    globalMemories: string[]
  ): Content[] => {
    const history: Content[] = [];
  
    let initialContext = "";
    if (systemInstruction) initialContext += systemInstruction + "\n\n";
  
    if (globalMemories.length > 0) {
      const memoriesText = `
  ---
  CONHECIMENTO PRÉVIO SOBRE O USUÁRIO (MEMÓRIAS):
  ${globalMemories.map(mem => `- ${mem}`).join("\n")}
  ---
  Use essas memórias para personalizar suas respostas e evitar perguntar sobre o que já foi informado.
  Se o usuário fornecer uma informação que contradiz uma memória, você pode perguntar para confirmar ou assumir a informação mais recente como correta e, se apropriado, sugerir uma atualização da memória relevante.
          \n\n`;
      initialContext += memoriesText;
    }
  
    if (initialContext) {
      history.push({ role: "user", parts: [{ text: initialContext }] });
      history.push({ role: "model", parts: [{ text: "Entendido. Contexto e memórias recebidos. Estou pronto para ajudar." }] });
    }
  
    conversationMessages.forEach(msg => {
      history.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    });
  
    return history;
  };
  
  const parseNewMemories = (responseText: string): { cleanedResponse: string; memories: string[] } => {
    const memories: string[] = [];
    const memoryRegex = /\[MEMORIZE:\s*"([^"]+)"\]/g;
    let match;
    let cleanedResponse = responseText;
  
    while ((match = memoryRegex.exec(responseText)) !== null) {
      if (match[1]) {
        memories.push(match[1]);
      }
    }
  
    cleanedResponse = cleanedResponse.replace(memoryRegex, "").trim();
  
    return { cleanedResponse, memories };
  };
  
  export async function* streamMessageToGemini(
    apiKey: string,
    conversationMessages: { sender: 'user' | 'ai'; text: string }[],
    currentUserMessageText: string,
    globalMemories: string[]
  ): AsyncGenerator<StreamedGeminiResponseChunk, void, undefined> {
    if (!apiKey) {
      yield { error: "Chave de API não fornecida.", isFinished: true };
      return;
    }
  
    const genAI = new GoogleGenAI({ apiKey });
  
    const systemInstruction = `
      Você é um assistente de IA prestativo e amigável, com uma interface inspirada no ChatGPT.
      Siga estas instruções RIGOROSAMENTE.
      INSTRUÇÕES IMPORTANTES SOBRE MEMÓRIA:
      1.  Ao responder, se você identificar na ÚLTIMA MENSAGEM DO USUÁRIO (a mensagem mais recente que ele enviou) alguma informação nova, factual e relevante que deva ser lembrada para futuras interações (como preferências específicas, fatos importantes sobre o usuário, nomes de projetos, objetivos declarados, etc.), inclua essa informação EXATAMENTE no seguinte formato: [MEMORIZE: "conteúdo da memória aqui"].
      2.  NÃO use este formato para informações triviais, perguntas do usuário, ou coisas que não são fatos persistentes sobre ele ou suas preferências. Seja MUITO seletivo.
      3.  Se houver múltiplas informações distintas para memorizar da ÚLTIMA MENSAGEM DO USUÁRIO, use o formato [MEMORIZE: "..."] para cada uma delas, separadamente.
      4.  O texto dentro de [MEMORIZE: "..."] NÃO deve aparecer na sua resposta visível ao usuário. O sistema irá processar e remover essas tags internamente.
      5.  Se não houver NADA para memorizar na ÚLTIMA MENSAGEM DO USUÁRIO, NÃO inclua a tag [MEMORIZE: "..."] de forma alguma.
      6.  Considere as memórias globais já fornecidas (se houver alguma na seção "CONHECIMENTO PRÉVIO") para personalizar suas respostas e evitar perguntar sobre o que já foi informado.
      7.  Sua resposta principal ao usuário deve ser útil e direta, e as tags [MEMORIZE: "..."] devem vir ao final da sua resposta completa, se aplicável.
    `;
  
    const fullConversationHistory = [...conversationMessages, { sender: 'user' as 'user' | 'ai', text: currentUserMessageText }];
  
    const chatHistoryForAPI = buildChatHistory(
      fullConversationHistory,
      systemInstruction,
      globalMemories
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
      maxOutputTokens: 2048,
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
        if (chunk && chunk.candidates && chunk.candidates.length > 0) {
          const candidate = chunk.candidates[0];
          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            const part = candidate.content.parts[0];
            if (part.text) {
              const chunkText = part.text;
              accumulatedText += chunkText;
              yield { delta: chunkText, isFinished: false };
            }
          }
        }
      }
  
      const { cleanedResponse, memories: newMemories } = parseNewMemories(accumulatedText);
      yield { finalText: cleanedResponse, newMemories, isFinished: true };
  
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
  