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

export interface GeminiModelConfig {
    model: GeminiModel;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    safetySettings?: SafetySetting[];
    thinkingBudget?: number; // Add this line
}

export type GoogleDriveSyncStatus = 'Disconnected' | 'Connecting' | 'Syncing' | 'Synced' | 'Error';

export interface GoogleDriveUser {
    email: string;
    name?: string;
    picture?: string;
}

export interface DriveMemory {
    id: string;
    content: string;
    lastModifiedAt: string; // ISO 8601 timestamp
    isDeleted?: boolean; // ADDED for soft delete
}


export interface FunctionDeclaration {
    id: string;
    name: string;
    description: string;
    parametersSchema: string;
    endpointUrl: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

// ADDED: Define ThemeName type
export type ThemeName = 'loox' | 'aulapp' | 'dracula-dark' | 'solarized-light' | 'one-dark' | 'github-light' | 'shades-of-purple' | 'shades-of-purple-light';

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
    theme: ThemeName; // MODIFIED: Use ThemeName
    showProcessingIndicators: boolean; // Add this line
    showAiFunctionCallAttachments: boolean; // New setting
    googleDriveAccessToken?: string;
    googleDriveUser?: GoogleDriveUser | null;
    googleDriveSyncStatus: GoogleDriveSyncStatus;
    googleDriveLastSync?: string; // ISO string for timestamp
    googleDriveError?: string;
}

export interface Memory {
    id:string;
    content: string;
    timestamp: Date;
    sourceMessageId?: string;
    isDeleted?: boolean; // ADDED for soft delete
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
    respondingToUserMessageId?: string; // Added this line
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
    isIncognito?: boolean; // Added for incognito mode
    isDeleted?: boolean; // ADDED for soft delete
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
    isDeleted?: boolean; // ADDED for soft delete
    isIncognito?: boolean; // ADDED for sync compatibility
}

export type DataSettingsTabProps = object;
export type MemoriesSettingsTabProps = object;

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
    functionAttachedFilesInfo?: AttachedFileInfo[]; // Add this line
}
