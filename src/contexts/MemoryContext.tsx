// src/contexts/MemoryContext.tsx
import React, { createContext, useContext, type ReactNode, useCallback } from 'react'; // Adicionado useCallback
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Memory } from '../types';
import { v4 as uuidv4 } from 'uuid';

const MEMORIES_KEY = 'geminiChat_memories';

interface MemoryContextType {
    memories: Memory[];
    addMemory: (content: string, sourceMessageId?: string) => void;
    deleteMemory: (id: string) => void;
    updateMemory: (id: string, newContent: string) => void; // Nova função
    clearAllMemories: () => void;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const MemoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [memories, setMemories] = useLocalStorage<Memory[]>(MEMORIES_KEY, []);

    const addMemory = useCallback((content: string, sourceMessageId?: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return; // Não adiciona memória vazia

        const newMemory: Memory = {
            id: uuidv4(),
            content: trimmedContent,
            timestamp: new Date(),
            sourceMessageId, // Pode ser undefined para memórias manuais
        };
        // Adiciona no início e evita duplicatas exatas de conteúdo
        setMemories(prev => [newMemory, ...prev.filter(m => m.content.toLowerCase() !== trimmedContent.toLowerCase())]
                            .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); // Ordenar por mais recente
    }, [setMemories]);

    const deleteMemory = useCallback((id: string) => {
        setMemories(prev => prev.filter(m => m.id !== id));
    }, [setMemories]);

    const updateMemory = useCallback((id: string, newContent: string) => {
        const trimmedNewContent = newContent.trim();
        if (!trimmedNewContent) { // Se o novo conteúdo for vazio, exclui a memória
            deleteMemory(id);
            return;
        }
        setMemories(prev =>
            prev.map(mem =>
                mem.id === id ? { ...mem, content: trimmedNewContent, timestamp: new Date() } : mem
            ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) // Reordena após update
        );
    }, [setMemories, deleteMemory]); // deleteMemory é dependência aqui

    const clearAllMemories = useCallback(() => {
        setMemories([]);
    }, [setMemories]);

    return (
        <MemoryContext.Provider value={{ memories, addMemory, deleteMemory, updateMemory, clearAllMemories }}>
            {children}
        </MemoryContext.Provider>
    );
};

export const useMemories = (): MemoryContextType => {
    const context = useContext(MemoryContext);
    if (context === undefined) {
        throw new Error('useMemories must be used within a MemoryProvider');
    }
    return context;
};