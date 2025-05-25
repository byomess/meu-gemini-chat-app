import { StreamedGeminiResponseChunk } from '../geminiService'; // Import the type from the main service file

const createMemoryRegex = /\[MEMORIZE:\s*"([^"]+)"\]/g;
const updateMemoryRegex = /\[UPDATE_MEMORY original:\s*"([^"]+)"\s*new:\s*"([^"]+)"\]/g;
const deleteMemoryRegex = /\[DELETE_MEMORY:\s*"([^"]+)"\]/g;

/**
 * Parses a given response text for specific memory operation commands (create, update, delete).
 * Returns the cleaned text (without commands) and an array of detected memory operations.
 */
export const parseMemoryOperations = (responseText: string): {
    cleanedResponse: string;
    operations: StreamedGeminiResponseChunk['memoryOperations'];
} => {
    const operations: NonNullable<StreamedGeminiResponseChunk['memoryOperations']> = [];
    let cleanedResponse = responseText;

    const updateMatches = Array.from(responseText.matchAll(updateMemoryRegex));
    updateMatches.forEach(match => {
        if (match[1] && match[2]) {
            operations.push({ action: 'update', targetMemoryContent: match[1].trim(), content: match[2].trim() });
        }
    });
    cleanedResponse = cleanedResponse.replace(updateMemoryRegex, "").trim();

    const deleteMatches = Array.from(cleanedResponse.matchAll(deleteMemoryRegex));
    deleteMatches.forEach(match => {
        if (match[1]) {
            operations.push({ action: 'delete_by_ai_suggestion', targetMemoryContent: match[1].trim() });
        }
    });
    cleanedResponse = cleanedResponse.replace(deleteMemoryRegex, "").trim();

    const createMatches = Array.from(cleanedResponse.matchAll(createMemoryRegex));
    createMatches.forEach(match => {
        if (match[1]) {
            operations.push({ action: 'create', content: match[1].trim() });
        }
    });
    cleanedResponse = cleanedResponse.replace(createMemoryRegex, "").trim();

    return { cleanedResponse, operations: operations.length > 0 ? operations : undefined };
};
