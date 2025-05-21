// src/types/index.ts

// Importa e reexporta os tipos diretamente do SDK do Gemini
// Isso garante que estamos usando os tipos exatos que o SDK espera.
import type {
    SafetySetting as GenaiSafetySetting,
    Part as GenaiPart // Adicionado para rawParts
} from '@google/genai';

export { HarmCategory, HarmBlockThreshold } from '@google/genai';

export type SafetySetting = GenaiSafetySetting; // Usaremos este tipo do SDK
export type Part = GenaiPart; // Reexportando Part

export type GeminiModel =
    | "gemini-2.5-pro-preview-05-06"
    | "gemini-2.5-flash-preview-04-17"
    | "gemini-2.0-flash";

export interface GeminiModelConfig {
    model: GeminiModel;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    safetySettings?: SafetySetting[];
}

export interface FunctionDeclaration {
    id: string;
    name: string;
    description: string;
    parametersSchema: string;
    endpointUrl: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export interface AppSettings {
    apiKey: string;
    theme?: 'dark' | 'light';
    geminiModelConfig: GeminiModelConfig;
    customPersonalityPrompt: string;
    functionDeclarations: FunctionDeclaration[];
    codeSynthaxHighlightEnabled: boolean;
}

export interface Memory {
    id: string;
    content: string;
    timestamp: Date;
    sourceMessageId?: string;
}

export type MemoryActionType = 'created' | 'updated' | 'deleted_by_ai';

export interface AttachedFileInfo {
    id: string;
    name: string;
    type: string;
    size: number;
    dataUrl?: string;
}

// Novo: Tipos para o status de processamento
export type ProcessingType =
    | 'function_call_request'         // IA decidiu chamar uma função
    | 'function_call_execution'       // Loox está executando a função (chamada HTTP, etc.)
    | 'function_call_response'        // Resposta da função recebida, aguardando IA processar
    | 'user_attachment_upload'        // Upload de arquivos do usuário para a API Gemini
    | 'file_from_function_processing';// Arquivo retornado por função sendo processado/disponibilizado para IA

export type ProcessingStage =
    | 'pending'                       // Ação iniciada, aguardando
    | 'in_progress'                   // Em execução
    | 'awaiting_ai'                   // Submetido à IA, aguardando que ela use/processe
    | 'completed'                     // Concluído com sucesso (pode ser um estágio intermediário)
    | 'failed';                       // Falhou

export interface ProcessingStatus {
    type: ProcessingType;
    stage: ProcessingStage;
    name?: string; // Nome da função, nome do arquivo
    details?: string; // Mensagem adicional de status, ex: "Aguardando API externa...", "Analisando conteúdo..."
    error?: string; // Mensagem de erro se stage for 'failed'
}
// Fim do Novo

export interface MessageMetadata {
    temp?: boolean;
    isLoading?: boolean;
    error?: boolean | string; // Mantido para erros gerais da mensagem
    abortedByUser?: boolean;
    userFacingError?: string; // Mantido para erros gerais da mensagem
    attachedFilesInfo?: AttachedFileInfo[];
    memorizedMemoryActions?: {
        id: string;
        content: string;
        originalContent?: string;
        action: MemoryActionType;
    }[];
    rawParts?: Part[]; // Usando o tipo Part importado
    processingStatus?: ProcessingStatus; // Novo campo para status detalhado
}

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'model' | 'function'; // 'function' é para a RESPOSTA da função, não o pedido
    timestamp: Date;
    metadata?: MessageMetadata;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}
