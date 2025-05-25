import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentConfig,
    type Content,
    type Part,
    type GenerateContentResponse,
    type FunctionCall,
    type GenerateContentRequest, // Added this import
} from "@google/genai";

import type {
    GeminiModelConfig,
    FunctionDeclaration as AppFunctionDeclaration,
    SafetySetting,
    ProcessingStatus,
    AttachedFileInfo,
} from '../types';

import { RawFileAttachment, processUserAttachment } from './gemini/fileUploader';
import { buildApiTools, executeDeclaredFunctionAndProcessResult } from './gemini/toolExecutor';
import { buildChatHistory } from './gemini/chatHistoryBuilder';
import { parseMemoryOperations } from './gemini/memoryParser';
import { handleGeminiApiError } from './gemini/apiErrorHandlers';

const USER_ROLE = "user";
const MODEL_ROLE = "model";
const FUNCTION_ROLE = "function";

export interface StreamedGeminiResponseChunk {
    delta?: string;
    finalText?: string;
    memoryOperations?: {
        action: 'create' | 'update' | 'delete_by_ai_suggestion';
        content?: string;
        targetMemoryContent?: string;
        idToUpdate?: string;
    }[];
    error?: string;
    isFinished: boolean;
    processingStatus?: ProcessingStatus;
    rawPartsForNextTurn?: Part[];
    functionAttachedFilesInfo?: AttachedFileInfo[];
}

export async function* streamMessageToGemini(
    apiKey: string,
    conversationHistory: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[],
    currentUserMessageText: string,
    attachedRawFiles: RawFileAttachment[],
    globalMemoriesObjects: { id: string; content: string }[],
    modelConfig: GeminiModelConfig,
    systemInstructionString: string,
    functionDeclarations: AppFunctionDeclaration[],
    abortSignal?: AbortSignal,
    webSearchEnabled?: boolean,
): AsyncGenerator<StreamedGeminiResponseChunk, void, undefined> {
    if (!apiKey) {
        yield { error: "Chave de API não fornecida.", isFinished: true };
        return;
    }
    if (abortSignal?.aborted) {
        yield { error: "Operação abortada antes de iniciar.", isFinished: true };
        return;
    }

    const genAI = new GoogleGenAI({ apiKey: apiKey });
    const globalMemoriesContent = globalMemoriesObjects.map(mem => mem.content);
    const currentChatHistory: Content[] = buildChatHistory(conversationHistory, globalMemoriesContent);
    const initialUserParts: Part[] = [];

    try {
        // 1. Process User Attachments
        if (attachedRawFiles && attachedRawFiles.length > 0) {
            for (const rawFileAttachment of attachedRawFiles) {
                try {
                    const filePart = yield* processUserAttachment(genAI, rawFileAttachment, abortSignal);
                    initialUserParts.push(filePart);
                } catch (error) {
                    console.warn(`Skipping file due to error: ${error}`);
                }
            }
            if (initialUserParts.length > 0) {
                yield { delta: "Anexos do usuário processados. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'completed', details: 'Todos os anexos prontos para a IA.' } };
            } else if (attachedRawFiles.length > 0) {
                yield { delta: "Falha ao processar anexos do usuário. ", isFinished: false, processingStatus: { type: 'user_attachment_upload', stage: 'failed', details: 'Nenhum anexo pôde ser processado.' } };
            }
        }

        // 2. Add current user text message
        if (currentUserMessageText.trim()) {
            initialUserParts.push({ text: currentUserMessageText.trim() });
        }

        // 3. Add initial user parts to history if any
        if (initialUserParts.length > 0) {
            currentChatHistory.push({ role: USER_ROLE, parts: initialUserParts });
        } else {
            const userMessagesInHistory = currentChatHistory.filter(
                c => c.role === USER_ROLE &&
                    (c.parts ?? []).some(p =>
                        (p.text && p.text.trim() !== "" && !p.text.startsWith("---") && !p.text.startsWith("(Nenhuma memória global")) ||
                        p.fileData || p.inlineData
                    )
            );
            if (userMessagesInHistory.length === 0 && !currentUserMessageText.trim() && (!attachedRawFiles || attachedRawFiles.length === 0)) {
                yield { error: "Nenhum conteúdo de usuário válido para enviar.", isFinished: true };
                return;
            }
        }

        // 4. Prepare API Configuration
        const safetySettingsForAPI: SafetySetting[] | undefined = modelConfig.safetySettings?.map(s => ({
            category: s.category as HarmCategory, threshold: s.threshold as HarmBlockThreshold,
        }));
        const systemInstructionForAPI: Part | undefined = systemInstructionString.trim()
            ? { text: systemInstructionString.trim() } : undefined;
        const generationConfig: GenerateContentConfig = {
            temperature: modelConfig.temperature, topK: modelConfig.topK === 0 ? undefined : modelConfig.topK,
            topP: modelConfig.topP, maxOutputTokens: modelConfig.maxOutputTokens,
        };

        let accumulatedTextForFinalResponse = "";
        let toolsForApiNextTurn = buildApiTools(webSearchEnabled, functionDeclarations);

        // 5. Main interaction loop (handles potential function calls)
        while (true) {
            // The AbortSignal is passed to generateContentStream.
            // While the library *should* handle it, a manual check here ensures immediate termination
            // if the signal is aborted during the asynchronous iteration over the stream.
            const requestConfig: Omit<GenerateContentConfig, 'model' | 'contents'> = {
                ...generationConfig,
                ...(safetySettingsForAPI && { safetySettings: safetySettingsForAPI }),
                systemInstruction: systemInstructionForAPI,
                tools: toolsForApiNextTurn,
                ...(modelConfig.thinkingBudget !== undefined && modelConfig.thinkingBudget > 0 && {
                    thinkingConfig: {
                        thinkingBudget: modelConfig.thinkingBudget
                    }
                })
            };
            const requestPayloadForAPI: GenerateContentRequest = { // Changed type here
                model: modelConfig.model,
                contents: currentChatHistory,
                config: requestConfig
            };

            const streamResult: AsyncIterable<GenerateContentResponse> = await genAI.models.generateContentStream(requestPayloadForAPI);

            let modelResponsePartsAggregatedThisTurn: Part[] = [];
            let hasFunctionCallInThisTurn = false;
            let currentTurnTextDelta = "";
            let functionCallRequestStatusEmitted = false;
            let attachedFilesFromFunctionThisTurn: AttachedFileInfo[] = [];

            for await (const chunk of streamResult) {
                if (abortSignal?.aborted) {
                    throw new DOMException("Aborted by user during stream processing.", "AbortError");
                }
                const candidate = chunk.candidates?.[0];
                if (!candidate || !candidate.content || !candidate.content.parts) continue;

                let chunkProcessingStatus: ProcessingStatus | undefined = undefined;

                for (const part of candidate.content.parts) {
                    modelResponsePartsAggregatedThisTurn.push(part);
                    if (part.functionCall) {
                        hasFunctionCallInThisTurn = true;
                        if (!functionCallRequestStatusEmitted) {
                            chunkProcessingStatus = {
                                type: 'function_call_request',
                                stage: 'pending',
                                name: part.functionCall.name,
                                details: `IA solicitou a função: ${part.functionCall.name}`
                            };
                            functionCallRequestStatusEmitted = true;
                        }
                    }
                    if (part.text) currentTurnTextDelta += part.text;
                }

                if (chunkProcessingStatus || currentTurnTextDelta) {
                    yield {
                        delta: currentTurnTextDelta || undefined,
                        isFinished: false,
                        processingStatus: chunkProcessingStatus,
                        functionAttachedFilesInfo: attachedFilesFromFunctionThisTurn.length > 0 ? attachedFilesFromFunctionThisTurn : undefined,
                    };
                    if (currentTurnTextDelta) accumulatedTextForFinalResponse += currentTurnTextDelta;
                    currentTurnTextDelta = "";
                    attachedFilesFromFunctionThisTurn = [];
                }
            }

            if (modelResponsePartsAggregatedThisTurn.length > 0) {
                currentChatHistory.push({ role: MODEL_ROLE, parts: modelResponsePartsAggregatedThisTurn });
                yield { isFinished: false, rawPartsForNextTurn: [...modelResponsePartsAggregatedThisTurn] };
            }

            if (hasFunctionCallInThisTurn) {
                const functionCallPartFound = modelResponsePartsAggregatedThisTurn.find(p => p.functionCall)?.functionCall as FunctionCall | undefined;

                if (functionCallPartFound) {
                    const { name: funcName, args: funcArgs } = functionCallPartFound;
                    const declaredFunction = functionDeclarations.find(df => df.name === funcName);

                    if (declaredFunction) {
                        const { functionResponseContent, fileDataPartForUserContext, attachedFilesFromFunction: newAttachedFiles } = yield* executeDeclaredFunctionAndProcessResult(
                            genAI, declaredFunction, funcArgs as Record<string, unknown>, abortSignal
                        );

                        if (newAttachedFiles && newAttachedFiles.length > 0) {
                            attachedFilesFromFunctionThisTurn.push(...newAttachedFiles);
                        }

                        currentChatHistory.push({
                            role: FUNCTION_ROLE, parts: [
                                { functionResponse: { name: funcName, response: { name: funcName, content: functionResponseContent } } }
                            ]
                        });

                        if (fileDataPartForUserContext) {
                            currentChatHistory.push({
                                role: USER_ROLE,
                                parts: [
                                    { text: `[Sistema: Arquivo '${(functionResponseContent as {fileName?:string})?.fileName || 'desconhecido'}' obtido pela função '${funcName}' e adicionado ao contexto para análise.]` },
                                    fileDataPartForUserContext
                                ]
                            });
                        }

                        yield {
                            isFinished: false,
                            processingStatus: { type: 'function_call_response', stage: 'awaiting_ai', name: funcName, details: 'Resposta da função enviada à IA para processamento.' },
                            functionAttachedFilesInfo: attachedFilesFromFunctionThisTurn.length > 0 ? attachedFilesFromFunctionThisTurn : undefined,
                        };
                        attachedFilesFromFunctionThisTurn = [];

                    } else {
                        currentChatHistory.push({
                            role: FUNCTION_ROLE, parts: [
                                { functionResponse: { name: funcName, response: { name: funcName, content: { status: "error", error_message: `Função '${funcName}' não encontrada no sistema.` } } } }
                            ]
                        });
                        yield {
                            delta: `\n[Loox: Função '${funcName}' não encontrada.]\n`,
                            isFinished: false,
                            processingStatus: { type: 'function_call_request', stage: 'failed', name: funcName, error: 'Função não declarada/encontrada no sistema.' }
                        };
                    }

                    toolsForApiNextTurn = buildApiTools(webSearchEnabled, functionDeclarations);
                    functionCallRequestStatusEmitted = false;
                    continue;
                }
            }

            const { cleanedResponse, operations } = parseMemoryOperations(accumulatedTextForFinalResponse);
            yield {
                finalText: cleanedResponse,
                memoryOperations: operations,
                isFinished: true,
                functionAttachedFilesInfo: attachedFilesFromFunctionThisTurn.length > 0 ? attachedFilesFromFunctionThisTurn : undefined,
            };
            return;

        }

    } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
            yield { error: "Resposta abortada pelo usuário.", isFinished: true };
            return;
        }
        const errorMessage = handleGeminiApiError(error, modelConfig.model);
        yield { error: errorMessage, isFinished: true };
    }
}
