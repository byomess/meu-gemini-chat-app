export * from './conversation';
export * from './memory';
// Não exportar './settings' aqui se AppSettings for definida neste arquivo
// export * from './settings'; // Remova ou comente esta linha

export type GeminiModel =
    | "gemini-2.5-pro-preview-05-06"
    | "gemini-2.5-flash-preview-04-17"
    | "gemini-2.0-flash";

export interface GeminiModelConfig {
    model: GeminiModel;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
}

export interface FunctionDeclaration {
    id: string;
    name: string;
    description: string;
    parametersSchema: string; // JSON string for parameters schema
    endpointUrl: string; // Adicionado
    httpMethod: 'GET' | 'POST'; // Adicionado
}

export interface AppSettings {
    apiKey: string;
    theme: 'dark' | 'light'; // Supondo que theme ainda é relevante, mantido de src/types/settings.ts
    geminiModelConfig: GeminiModelConfig;
    customPersonalityPrompt: string;
    functionDeclarations: FunctionDeclaration[];
}