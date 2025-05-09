// src/contexts/MemoryContext.tsx
import React, { createContext, useContext, type ReactNode, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Memory } from '../types';
import { v4 as uuidv4 } from 'uuid';

const MEMORIES_KEY = 'geminiChat_memories';

interface MemoryContextType {
    memories: Memory[];
    addMemory: (content: string, sourceMessageId?: string) => void;
    deleteMemory: (id: string) => void;
    updateMemory: (id: string, newContent: string) => void;
    clearAllMemories: () => void;
    replaceAllMemories: (newMemories: Memory[]) => void; // Nova função para importação
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const MemoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [memories, setMemories] = useLocalStorage<Memory[]>(MEMORIES_KEY, []);

    const addMemory = useCallback((content: string, sourceMessageId?: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return;

        const newMemory: Memory = {
            id: uuidv4(),
            content: trimmedContent,
            timestamp: new Date(),
            sourceMessageId,
        };
        setMemories(prev =>
            [newMemory, ...prev.filter(m => m.content.toLowerCase() !== trimmedContent.toLowerCase())]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
    }, [setMemories]);

    const deleteMemory = useCallback((id: string) => {
        setMemories(prev => prev.filter(m => m.id !== id));
    }, [setMemories]);

    const updateMemory = useCallback((id: string, newContent: string) => {
        const trimmedNewContent = newContent.trim();
        if (!trimmedNewContent) {
            if (window.confirm("O conteúdo da memória está vazio. Deseja excluir esta memória?")) {
                setMemories(prev => prev.filter(m => m.id !== id));
            }
            return;
        }
        setMemories(prev =>
            prev.map(mem =>
                mem.id === id ? { ...mem, content: trimmedNewContent, timestamp: new Date() } : mem
            ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
    }, [setMemories]);

    const clearAllMemories = useCallback(() => {
        if (window.confirm('Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita.')) {
            setMemories([]);
        }
    }, [setMemories]);

    const replaceAllMemories = useCallback((newMemories: Memory[]) => {
        // Validar minimamente o formato das memórias importadas
        const isValidFormat = newMemories.every(
            mem => typeof mem.id === 'string' && typeof mem.content === 'string' && mem.timestamp
        );
        if (!isValidFormat) {
            alert("Formato de arquivo de memórias inválido. A importação foi cancelada.");
            return;
        }
        // Assegurar que timestamps sejam objetos Date
        const processedMemories = newMemories.map(mem => ({
            ...mem,
            timestamp: new Date(mem.timestamp) // Converte string ISO para Date, se necessário
        })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setMemories(processedMemories);
        alert(`${processedMemories.length} memórias importadas com sucesso!`);
    }, [setMemories]);


    return (
        <MemoryContext.Provider value={{
            memories,
            addMemory,
            deleteMemory,
            updateMemory,
            clearAllMemories,
            replaceAllMemories // Expor a nova função
        }}>
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