// src/contexts/MemoryContext.tsx
import React, { createContext, useContext, type ReactNode, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Memory } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useAppSettings } from './AppSettingsContext'; // ADDED
import { useGoogleDriveSync } from '../hooks/useGoogleDriveSync'; // ADDED

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
    replaceAllMemories: (newMemories: Memory[], source?: string) => Memory[]; // MODIFIED: Added source parameter
}

export const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const MemoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [memories, setMemories] = useLocalStorage<Memory[]>(MEMORIES_KEY, [], memoryReviver);
    const { settings } = useAppSettings(); // ADDED
    const { syncMemories: actualSyncFunctionFromHook } = useGoogleDriveSync(); // ADDED

    const syncMemoriesRef = useRef(actualSyncFunctionFromHook); // ADDED
    useEffect(() => { // ADDED
        syncMemoriesRef.current = actualSyncFunctionFromHook;
    }, [actualSyncFunctionFromHook]);

    const triggerSync = useCallback(() => { // ADDED helper
        if (settings.googleDriveAccessToken) {
            syncMemoriesRef.current().catch(error => console.error("Memory sync failed:", error));
        }
    }, [settings.googleDriveAccessToken]); // syncMemoriesRef is stable

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
        
        triggerSync(); // MODIFIED: Call sync
        return newMemory;
    }, [setMemories, triggerSync]); // MODIFIED: Added triggerSync

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
            ).sort(sortByTimestampDesc)
        );
        triggerSync(); // MODIFIED: Call sync
    }, [setMemories, triggerSync]); // MODIFIED: Added triggerSync

    const clearAllMemories = useCallback(() => {
        if (window.confirm('Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita.')) {
            setMemories([]);
            triggerSync(); // MODIFIED: Call sync
        }
    }, [setMemories, triggerSync]); // MODIFIED: Added triggerSync

    const replaceAllMemories = useCallback((newMemories: Memory[], source?: string): Memory[] => { // MODIFIED: Added source parameter
        const isValidFormat = newMemories.every(
            mem => typeof mem.id === 'string' && typeof mem.content === 'string' && mem.timestamp
        );
        if (!isValidFormat) {
            alert("Formato de arquivo de memórias inválido. A importação foi cancelada.");
            return memories; // Return current memories on invalid format
        }
        const processedMemories = newMemories.map(mem => ({
            ...mem,
            timestamp: new Date(mem.timestamp)
        })).sort(sortByTimestampDesc);

        setMemories(processedMemories);
        
        if (source !== 'sync') { // MODIFIED: Conditional sync
            triggerSync();
        }
        return processedMemories;
    }, [setMemories, triggerSync, memories]); // MODIFIED: Added triggerSync and memories (for return on error)


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
