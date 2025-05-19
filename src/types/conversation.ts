// src/types/conversation.ts
// Adicione 'Part' da SDK do Gemini se quiser ser mais específico, ou use any[]
// import type { Part } from '@google/genai'; // Opcional, para tipagem mais forte

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawParts?: unknown[]; // Alterado de 'any[]' para Part[] se você importar 'Part'
                      // Ou mantenha any[] para simplicidade se não quiser importar Part aqui.
}

export interface Message {
    id: string;
    text: string; // Pode ser o texto renderizável ou um resumo/placeholder se rawParts existir
    sender: 'user' | 'model' | 'function'; // Adicionado 'function'
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