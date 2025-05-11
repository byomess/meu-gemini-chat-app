export * from './conversation';
export * from './memory';
export * from './settings';

export type GeminiModel =
    | "gemini-2.5-pro-preview-05-06"
    | "gemini-2.5-flash-preview-04-17"
    | "gemini-2.0-flash"

export interface GeminiModelConfig {
    model: GeminiModel;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
}

export interface AppSettings {
    apiKey: string;
    theme: 'dark' | 'light';
    geminiModelConfig: GeminiModelConfig;
}