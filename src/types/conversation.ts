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
}

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
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