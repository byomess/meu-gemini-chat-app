export type MemoryActionType = 'created' | 'updated' | 'deleted_by_ai'; // Adicionando 'deleted_by_ai'

export interface MessageMetadata {
    temp?: boolean;
    isLoading?: boolean;
    // memorizedItems?: string[]; // Pode ser depreciado se memorizedMemoryActions cobrir
    error?: boolean;
    // Novo campo para rastrear ações de memória
    memorizedMemoryActions?: {
        id: string; // ID da memória afetada
        content: string; // Conteúdo (novo ou antigo, dependendo da ação)
        originalContent?: string; // Conteúdo original (para 'updated' e 'deleted_by_ai')
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