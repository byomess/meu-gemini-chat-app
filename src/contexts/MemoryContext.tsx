import React, { createContext, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Memory } from '../types';
import { v4 as uuidv4 } from 'uuid';

const MEMORIES_KEY = 'geminiChat_memories';

interface MemoryContextType {
    memories: Memory[];
    addMemory: (content: string, sourceMessageId?: string) => void;
    deleteMemory: (id: string) => void;
    clearAllMemories: () => void;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const MemoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [memories, setMemories] = useLocalStorage<Memory[]>(MEMORIES_KEY, []);

    const addMemory = (content: string, sourceMessageId?: string) => {
        const newMemory: Memory = {
            id: uuidv4(),
            content,
            timestamp: new Date(),
            sourceMessageId,
        };
        setMemories(prev => [newMemory, ...prev.filter(m => m.content !== content)]); // Evita duplicatas exatas de conteúdo
    };

    const deleteMemory = (id: string) => {
        setMemories(prev => prev.filter(m => m.id !== id));
    };

    const clearAllMemories = () => {
        setMemories([]);
    };

    return (
        <MemoryContext.Provider value={{ memories, addMemory, deleteMemory, clearAllMemories }}>
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