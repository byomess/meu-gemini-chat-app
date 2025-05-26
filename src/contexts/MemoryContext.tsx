// src/contexts/MemoryContext.tsx
import React, { createContext, useContext, type ReactNode, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Memory } from '../types';
import { v4 as uuidv4 } from 'uuid';

const MEMORIES_KEY = 'geminiChat_memories';

// Helper para ordenação por timestamp decrescente
const sortByTimestampDesc = (a: Memory, b: Memory) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

// Reviver function specifically for Memory objects to ensure timestamp is a Date
const memoryReviver = (key: string, value: any): any => {
    if (key === 'timestamp' && typeof value === 'string') {
        const dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.exec(value);
        if (dateMatch) {
            return new Date(value);
        }
    }
    return value;
};

interface MemoryContextType {
    memories: Memory[];
    addMemory: (content: string, sourceMessageId?: string) => Memory | undefined;
    deleteMemory: (id: string) => void;
    updateMemory: (id: string, newContent: string) => void;
    clearAllMemories: () => void;
    replaceAllMemories: (newMemories: Memory[]) => Memory[]; // Modified to return Memory[]
}

export const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const MemoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Pass the memoryReviver to useLocalStorage
    const [memories, setMemories] = useLocalStorage<Memory[]>(MEMORIES_KEY, [], memoryReviver);

    const addMemory = useCallback((content: string, sourceMessageId?: string): Memory | undefined => {
        const trimmedContent = content.trim();
        
        console.log("Tentativa de adicionar memória:", trimmedContent, sourceMessageId);
        if (!trimmedContent) return undefined; // Se o conteúdo estiver vazio, não adiciona e retorna undefined

        const newMemory: Memory = {
            id: uuidv4(),
            content: trimmedContent,
            timestamp: new Date(),
            sourceMessageId,
        };

        console.log("Nova memória criada:", newMemory);

        setMemories(prev => {
            const updatedMemories = [newMemory, ...prev.filter(m => m.content.toLowerCase() !== trimmedContent.toLowerCase())]
                .sort(sortByTimestampDesc);
            return updatedMemories;
        });

        return newMemory; // RETORNA O OBJETO DA MEMÓRIA CRIADA
    }, [setMemories]);

    const deleteMemory = useCallback((id: string) => {
        console.log("Tentativa de deletar memória:", id);
        setMemories(prev => {
            const updatedMemories = prev.filter(m => {
                const shouldDelete = m.id === id;
                if (shouldDelete) {
                    console.log("Memória deletada:", m);
                }
                return !shouldDelete;
            });
            return updatedMemories;
        });
    }, [setMemories]);

    const updateMemory = useCallback((id: string, newContent: string) => {
        const trimmedNewContent = newContent.trim();
        console.log("Tentativa de atualizar memória:", id, trimmedNewContent);
        if (!trimmedNewContent) {
            // Se o novo conteúdo for vazio, pergunta ao usuário se deseja excluir a memória
            if (window.confirm("O conteúdo da memória está vazio. Deseja excluir esta memória?")) {
                setMemories(prev => prev.filter(m => m.id !== id));
            }
            return; // Retorna para não atualizar com conteúdo vazio se o usuário não confirmar a exclusão
        }

        console.log("Atualizando memória:", id, trimmedNewContent);
        setMemories(prev =>
            prev.map(mem =>
                mem.id === id ? { ...mem, content: trimmedNewContent, timestamp: new Date() } : mem
            ).sort(sortByTimestampDesc) // Reordena após a atualização para manter a mais recente no topo
        );
    }, [setMemories]);

    const clearAllMemories = useCallback(() => {
        if (window.confirm('Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita.')) {
            setMemories([]);
        }
    }, [setMemories]);

    const replaceAllMemories = useCallback((newMemories: Memory[]): Memory[] => {
        const isValidFormat = newMemories.every(
            mem => typeof mem.id === 'string' && typeof mem.content === 'string' && mem.timestamp
        );
        if (!isValidFormat) {
            alert("Formato de arquivo de memórias inválido. A importação foi cancelada.");
            return []; // Return empty array or handle error as appropriate
        }
        // Garante que timestamps sejam objetos Date e ordena
        const processedMemories = newMemories.map(mem => ({
            ...mem,
            timestamp: new Date(mem.timestamp)
        })).sort(sortByTimestampDesc);

        setMemories(processedMemories);
        // Note: replaceAllMemories is often called by syncMemories itself,
        // so we don't want to trigger another sync here to avoid loops.
        // The sync will have already happened or is in progress.
        return processedMemories; // Return the processed memories
    }, [setMemories]);


    return (
        <MemoryContext.Provider value={{
            memories,
            addMemory,
            deleteMemory,
            updateMemory,
            clearAllMemories,
            replaceAllMemories
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
