import { Content, Part } from "@google/genai";

const USER_ROLE = "user";
const MODEL_ROLE = "model";

/**
 * Builds the chat history in the format expected by the Gemini API,
 * including a segment for global memories.
 */
export const buildChatHistory = (
    priorConversationMessages: { sender: 'user' | 'model' | 'function'; text?: string; parts?: Part[] }[],
    globalMemories: string[]
): Content[] => {
    const history: Content[] = [];
    let memoriesTextSegment = "";
    if (globalMemories.length > 0) {
        memoriesTextSegment = `
  ---
  CONHECIMENTO PRÉVIO SOBRE O USUÁRIO (MEMÓRIAS ATUAIS E EXATAS):
  ${globalMemories.map((mem) => `- "${mem}"`).join("\n")}
  ---
  `;
    } else {
        memoriesTextSegment = "(Nenhuma memória global registrada no momento.)";
    }
    history.push({ role: USER_ROLE, parts: [{ text: memoriesTextSegment.trim() }] });
    history.push({ role: MODEL_ROLE, parts: [{ text: "Ok, entendi o conhecimento prévio." }] });

    priorConversationMessages.forEach(msg => {
        if (msg.parts) {
            history.push({
                role: msg.sender,
                parts: msg.parts
            });
        } else if (msg.text !== undefined) {
            history.push({
                role: msg.sender as 'user' | 'model',
                parts: [{ text: msg.text }]
            });
        }
    });
    return history;
};
