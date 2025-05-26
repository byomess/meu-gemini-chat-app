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
    const [allMemories, setAllMemories] = useLocalStorage<Memory[]>(MEMORIES_KEY, [], memoryReviver); // Renamed to allMemories
    const { settings } = useAppSettings();

    const lastMemoryChangeSourceRef = useRef<'user' | 'sync' | null>(null);

    // Define replaceAllMemories first, as it's needed by useGoogleDriveSync
    const replaceAllMemories = useCallback((newMemories: Memory[], source?: string): Memory[] => {
        const isValidFormat = newMemories.every(
            mem => typeof mem.id === 'string' && typeof mem.content === 'string' && mem.timestamp
        );
        if (!isValidFormat) {
            alert("Formato de arquivo de memórias inválido. A importação foi cancelada.");
            return allMemories; // Return current memories on invalid format
        }
        const processedMemories = newMemories.map(mem => ({
            ...mem,
            timestamp: new Date(mem.timestamp),
            isDeleted: mem.isDeleted || false, // Ensure isDeleted is present
        })).sort(sortByTimestampDesc);

        setAllMemories(processedMemories);
        
        if (source === 'sync') {
            lastMemoryChangeSourceRef.current = 'sync';
        } else {
            lastMemoryChangeSourceRef.current = 'user';
        }
        return processedMemories;
    }, [setAllMemories, allMemories]); // `allMemories` is needed for the return on error case.

    // Now call useGoogleDriveSync, passing the current allMemories and the replaceAllMemories function
    // Note: useGoogleDriveSync expects all memories, including soft-deleted ones for proper merging.
    const { syncMemories: actualSyncFunctionFromHook } = useGoogleDriveSync({ memories: allMemories, replaceAllMemories });

    const syncMemoriesRef = useRef(actualSyncFunctionFromHook);
    useEffect(() => {
        syncMemoriesRef.current = actualSyncFunctionFromHook;
    }, [actualSyncFunctionFromHook]); // This dependency is correct. actualSyncFunctionFromHook changes if its own dependencies change.

    // Effect to trigger sync when memories change, if initiated by user/AI
    useEffect(() => {
        if (lastMemoryChangeSourceRef.current === 'user' && settings.googleDriveAccessToken) {
            console.log("Memories changed by user/AI, triggering Google Drive sync.");
            syncMemoriesRef.current().catch(error => {
                console.error("Google Drive sync failed after memory change:", error);
            });
        }
        // Only reset if it was 'user'. If 'sync', it means replaceAllMemories was called by sync,
        // and we don't want to trigger another sync.
        if (lastMemoryChangeSourceRef.current === 'user') {
            lastMemoryChangeSourceRef.current = null; // Reset flag after processing
        }
    }, [allMemories, settings.googleDriveAccessToken, syncMemoriesRef]); // syncMemoriesRef added as it's used, allMemories

    const addMemory = useCallback((content: string, sourceMessageId?: string): Memory | undefined => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return undefined;

        let memoryAddedOrUpdated: Memory | undefined;

        setAllMemories(prev => {
            const existingMemoryIndex = prev.findIndex(m => m.content.toLowerCase() === trimmedContent.toLowerCase());

            if (existingMemoryIndex !== -1) {
                // Memory with same content exists
                const existingMemory = prev[existingMemoryIndex];
                if (existingMemory.isDeleted) {
                    // It was soft-deleted, so undelete it and update timestamp
                    memoryAddedOrUpdated = {
                        ...existingMemory,
                        isDeleted: false,
                        timestamp: new Date(),
                        sourceMessageId: sourceMessageId || existingMemory.sourceMessageId, // Preserve original if new one not provided
                    };
                    const updatedMemories = [...prev];
                    updatedMemories[existingMemoryIndex] = memoryAddedOrUpdated;
                    console.log("Memória 'des-deletada' e atualizada:", memoryAddedOrUpdated);
                    return updatedMemories.sort(sortByTimestampDesc);
                } else {
                    // It exists and is not deleted. Optionally, update its timestamp or do nothing.
                    // For now, let's update timestamp to bring it to top, effectively "re-adding" it.
                     memoryAddedOrUpdated = {
                        ...existingMemory,
                        timestamp: new Date(),
                        sourceMessageId: sourceMessageId || existingMemory.sourceMessageId,
                    };
                    const updatedMemories = [...prev];
                    updatedMemories[existingMemoryIndex] = memoryAddedOrUpdated;
                    console.log("Memória existente atualizada (timestamp):", memoryAddedOrUpdated);
                    return updatedMemories.sort(sortByTimestampDesc);
                }
            } else {
                // New memory
                memoryAddedOrUpdated = {
                    id: uuidv4(),
                    content: trimmedContent,
                    timestamp: new Date(),
                    sourceMessageId,
                    isDeleted: false,
                };
                console.log("Nova memória criada:", memoryAddedOrUpdated);
                return [memoryAddedOrUpdated, ...prev].sort(sortByTimestampDesc);
            }
        });
        lastMemoryChangeSourceRef.current = 'user';
        return memoryAddedOrUpdated;
    }, [setAllMemories]);

    const deleteMemory = useCallback((id: string) => {
        console.log("Tentativa de soft-deletar memória:", id);
        setAllMemories(prev =>
            prev.map(mem =>
                mem.id === id ? { ...mem, isDeleted: true, timestamp: new Date() } : mem
            ).sort(sortByTimestampDesc) // Keep sort order consistent
        );
        lastMemoryChangeSourceRef.current = 'user';
    }, [setAllMemories]);

    const updateMemory = useCallback((id: string, newContent: string) => {
        const trimmedNewContent = newContent.trim();
        console.log("Tentativa de atualizar memória:", id, trimmedNewContent);

        if (!trimmedNewContent) {
            if (window.confirm("O conteúdo da memória está vazio. Deseja excluir esta memória?")) {
                setAllMemories(prev =>
                    prev.map(mem =>
                        mem.id === id ? { ...mem, isDeleted: true, timestamp: new Date() } : mem
                    ).sort(sortByTimestampDesc)
                );
                lastMemoryChangeSourceRef.current = 'user';
            }
            return;
        }

        setAllMemories(prev =>
            prev.map(mem =>
                mem.id === id ? { ...mem, content: trimmedNewContent, timestamp: new Date(), isDeleted: false } : mem
            ).sort(sortByTimestampDesc)
        );
        lastMemoryChangeSourceRef.current = 'user';
    }, [setAllMemories]);

    const clearAllMemories = useCallback(() => {
        if (window.confirm('Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita (as memórias serão marcadas como deletadas).')) {
            setAllMemories(prev =>
                prev.map(mem => 
                    mem.isDeleted ? mem : { ...mem, isDeleted: true, timestamp: new Date() }
                ).sort(sortByTimestampDesc)
            );
            lastMemoryChangeSourceRef.current = 'user';
        }
    }, [setAllMemories]);

    // replaceAllMemories is now defined before useGoogleDriveSync call.
    // The SEARCH block for its definition was moved up.
    // This SEARCH block is now for the return statement.

    // Filtered memories for UI consumption
    const uiVisibleMemories = allMemories.filter(mem => !mem.isDeleted).sort(sortByTimestampDesc);

    return (
        <MemoryContext.Provider value={{
            memories: uiVisibleMemories, // Provide filtered memories to UI
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
