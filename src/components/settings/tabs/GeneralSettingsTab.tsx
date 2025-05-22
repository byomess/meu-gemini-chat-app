// src/components/settings/tabs/GeneralSettingsTab.tsx
import React from "react";

export const DEFAULT_PERSONALITY_FOR_PLACEHOLDER = `Você é uma IA professora / tutora de alunos que estão fazendo cursos na plataforma de ensino à distância Aulapp, e seu papel é ajudar os alunos a entenderem melhor o conteúdo do curso, responder perguntas e fornecer feedback sobre a evolução deles. Você deve ser amigável, paciente e encorajador, sempre buscando ajudar os alunos a aprenderem e se desenvolverem.`;

interface GeneralSettingsTabProps {
    currentApiKey: string;
    setCurrentApiKey: (key: string) => void;
    currentCustomPersonalityPrompt: string;
    setCurrentCustomPersonalityPrompt: (prompt: string) => void;
}

const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
    currentApiKey,
    setCurrentApiKey,
    currentCustomPersonalityPrompt,
    setCurrentCustomPersonalityPrompt,
}) => {
    return (
        <div className="space-y-6">
            <div>
                <label
                    htmlFor="apiKey"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                    Chave da API Google Gemini
                </label>
                <input
                    type="password"
                    id="apiKey"
                    name="apiKey"
                    placeholder="Cole sua chave da API aqui (ex: AIza...)"
                    value={currentApiKey}
                    onChange={(e) => setCurrentApiKey(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-gray-800 shadow-sm transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2">
                    Sua chave de API é armazenada localmente no seu navegador e nunca é
                    enviada para nossos servidores.
                </p>
            </div>
            <div>
                <label
                    htmlFor="customPersonalityPrompt"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                    Papel / Personalidade da IA (Prompt de Sistema)
                </label>
                <textarea
                    id="customPersonalityPrompt"
                    name="customPersonalityPrompt"
                    rows={5}
                    placeholder={`Padrão: "${DEFAULT_PERSONALITY_FOR_PLACEHOLDER.substring(
                        0,
                        100
                    )}..." (Deixe em branco para usar o padrão).`}
                    value={currentCustomPersonalityPrompt}
                    onChange={(e) => setCurrentCustomPersonalityPrompt(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-gray-800 shadow-sm transition-colors resize-y"
                />
                <p className="text-xs text-gray-500 mt-2">
                    Define a persona base da IA. Isso será incluído no início da mensagem
                    de sistema. Se deixado em branco, um prompt padrão será usado.
                </p>
            </div>
        </div>
    );
};

export default GeneralSettingsTab;
