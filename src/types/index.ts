// src/types/index.ts

import type {
    SafetySetting as GenaiSafetySetting,
    Part as GenaiPart
} from '@google/genai';

export { HarmCategory, HarmBlockThreshold } from '@google/genai';

export type SafetySetting = GenaiSafetySetting;
export type Part = GenaiPart;

export type GeminiModel =
    | "gemini-2.5-pro-preview-05-06"
    | "gemini-2.5-flash-preview-05-20"
    | "gemini-2.5-flash-preview-04-17"
    | "gemini-2.0-flash";

export interface GeminiModelConfig {
    model: GeminiModel;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    safetySettings?: SafetySetting[];
    thinkingBudget?: number; // Add this line
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
    geminiModelConfig: GeminiModelConfig;
    customPersonalityPrompt: string;
    functionDeclarations: FunctionDeclaration[];
    codeSynthaxHighlightEnabled: boolean;
    aiAvatarUrl?: string;
    enableWebSearch: boolean;
    enableAttachments: boolean;
    hideNavigation: boolean;
    theme: 'loox' | 'aulapp';
}

export interface Memory {
    id:string;
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

export type ProcessingType =
    | 'function_call_request'
    | 'function_call_execution'
    | 'function_call_response'
    | 'user_attachment_upload'
    | 'file_from_function_processing';

export type ProcessingStage =
    | 'pending'
    | 'in_progress'
    | 'awaiting_ai'
    | 'completed'
    | 'failed';

export interface ProcessingStatus {
    type: ProcessingType;
    stage: ProcessingStage;
    name?: string;
    details?: string;
    error?: string;
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
    rawParts?: Part[];
    processingStatus?: ProcessingStatus;
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

export interface UrlConfigFile {
    apiKey?: string;
    geminiModelConfig?: Partial<GeminiModelConfig>;
    customPersonalityPrompt?: string;
    functionDeclarations?: FunctionDeclaration[];
    aiAvatarUrl?: string;
    memories?: {
        id?: string;
        content: string;
        timestamp: string;
        sourceMessageId?: string;
    }[];
    codeSynthaxHighlightEnabled?: boolean;
    enableWebSearch?: boolean;
    enableAttachments?: boolean;
    hideNavigation?: boolean;
}

export interface RawImportedMessage {
    id?: string;
    text?: string;
    sender?: 'user' | 'model' | 'function';
    timestamp?: string;
    metadata?: MessageMetadata;
}

export interface RawImportedConversation {
    id?: string;
    title?: string;
    messages?: RawImportedMessage[];
    createdAt?: string;
    updatedAt?: string;
}

export type DataSettingsTabProps = object;
export type MemoriesSettingsTabProps = object;
