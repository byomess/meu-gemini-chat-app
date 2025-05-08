// src/types/conversation.ts
export interface MessageMetadata {
    temp?: boolean; // Para mensagens temporárias como "digitando"
    isLoading?: boolean; // Para indicar que o conteúdo está sendo streamado
    memorizedItems?: string[]; // Conteúdo das memórias que foram extraídas desta resposta da IA
    error?: boolean; // Se esta mensagem é um erro
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