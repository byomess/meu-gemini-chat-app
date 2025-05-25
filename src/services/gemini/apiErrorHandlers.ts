/**
 * Handles and formats error messages from the Gemini API for user display.
 * Provides more specific messages for common API errors like invalid API key, model not found, or quota issues.
 */
export function handleGeminiApiError(error: unknown, modelName: string): string {
    let errorMessage = "Ocorreu um erro ao contatar a IA.";
    if (error instanceof Error) {
        const apiErrorMessage = error.message;
        errorMessage = `Erro da API: ${apiErrorMessage}`;
        if (apiErrorMessage.toLowerCase().includes("api key") || apiErrorMessage.toLowerCase().includes("permission denied")) {
            errorMessage = "Chave de API inválida ou não autorizada.";
        } else if (apiErrorMessage.toLowerCase().includes("model not found")) {
            errorMessage = `Modelo "${modelName}" não encontrado.`;
        } else if (apiErrorMessage.toLowerCase().includes("quota")) {
            errorMessage = `Erro de quota da API: ${apiErrorMessage}`;
        } else if (apiErrorMessage.toLowerCase().includes("user location is not supported")) {
            errorMessage = `Erro da API: Localização não suportada. ${apiErrorMessage}`;
        } else if (apiErrorMessage.toLowerCase().includes("safety settings")) {
            errorMessage = `Erro da API relacionado às configurações de segurança: ${apiErrorMessage}`;
        }
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        errorMessage = `Erro da API: ${(error as { message: string }).message}`;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    let detailedErrorForLog: string | object = "Detalhes do erro indisponíveis";
    if (error && typeof error === 'object' && 'toJSON' in error && typeof (error as { toJSON?: () => unknown }).toJSON === 'function') {
        detailedErrorForLog = (error as { toJSON: () => unknown }).toJSON() as string | object;
    } else if (error instanceof Error) {
        detailedErrorForLog = { name: error.name, message: error.message, stack: error.stack };
    } else if (typeof error === 'string') { detailedErrorForLog = error; }
    console.error("GEMINI_SERVICE: Erro ao chamar API Gemini (stream):", detailedErrorForLog);

    return errorMessage;
}
