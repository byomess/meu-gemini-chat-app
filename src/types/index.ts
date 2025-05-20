// src/types/index.ts

// Importa e reexporta os tipos diretamente do SDK do Gemini
// Isso garante que estamos usando os tipos exatos que o SDK espera.
import type {
    SafetySetting as GenaiSafetySetting
} from '@google/genai';

export { HarmCategory, HarmBlockThreshold } from '@google/genai';

export type SafetySetting = GenaiSafetySetting; // Usaremos este tipo do SDK

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
    safetySettings?: SafetySetting[]; // Agora usa o SafetySetting do @google/genai
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

// Tipos de conversação (sem alterações nesta correção específica)
export type MemoryActionType = 'created' | 'updated' | 'deleted_by_ai';

export interface AttachedFileInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export interface MessageMetadata {
    temp?: boolean;
    isLoading?: boolean;
    error?: boolean | string;
    abortedByUser?: boolean;
    userFacingError?: string;
    attachedFilesInfo?: AttachedFileInfo[];
    memorizedMemoryActions?: {
        id: string;
        content: string;
        originalContent?: string;
        action: MemoryActionType;
    }[];
    rawParts?: unknown[];
}

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'model' | 'function';
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