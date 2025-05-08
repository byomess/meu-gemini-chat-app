export interface Memory {
  id: string;
  content: string;
  timestamp: Date;
  sourceMessageId?: string; // ID da mensagem que originou esta memória
}
