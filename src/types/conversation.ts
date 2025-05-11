export type MemoryActionType = 'created' | 'updated' | 'deleted_by_ai'; // Adicionando 'deleted_by_ai'

export interface AttachedFileInfo {
  id: string;       // ID único para o anexo (ex: uuid)
  name: string;     // Nome original do arquivo
  type: string;     // MIME type do arquivo
  size: number;     // Tamanho do arquivo em bytes
  dataUrl?: string;  // Para imagens: string base64 no formato "data:mime/type;base64,..."
                     // Para outros arquivos, pode estar ausente ou ser um link para um ícone genérico
}

export interface MessageMetadata {
    temp?: boolean;
    isLoading?: boolean;
    error?: boolean | string;
    attachedFilesInfo?: AttachedFileInfo[];
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