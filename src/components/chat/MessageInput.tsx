// src/components/chat/MessageInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import { IoSend, IoPulseOutline, IoWarningOutline } from 'react-icons/io5'; // Adicionar IoWarningOutline
import { useConversations } from '../../contexts/ConversationContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';
import { streamMessageToGemini } from '../../services/geminiService';

const MessageInput: React.FC = () => {
  const {
    activeConversationId,
    activeConversation, // Para obter o histórico de mensagens para a API
    addMessageToConversation,
    updateMessageInConversation,
  } = useConversations();
  const { settings } = useAppSettings();
  const { memories: globalMemories, addMemory: addNewGlobalMemory } = useMemories();

  const [text, setText] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
  const [errorFromAI, setErrorFromAI] = useState<string | null>(null); // Para mostrar erros específicos da IA no input
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_TEXTAREA_HEIGHT = 160; // Aproximadamente 10rem ou max-h-40

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
      textareaRef.current.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

  // Focar no textarea quando uma conversa ativa é selecionada ou criada, e não há texto/loading
  useEffect(() => {
    if (activeConversationId && textareaRef.current && text === '' && !isLoadingAI) {
      textareaRef.current.focus();
    }
  }, [activeConversationId, text, isLoadingAI]);

  // Limpar erro da IA quando o usuário começa a digitar
  useEffect(() => {
    if (text !== '' && errorFromAI) {
      setErrorFromAI(null);
    }
  }, [text, errorFromAI]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFromAI(null); // Limpa erros anteriores ao tentar enviar
    const trimmedText = text.trim();

    if (!trimmedText || !activeConversationId || isLoadingAI) {
      return;
    }

    if (!settings.apiKey) {
      // Adiciona uma mensagem de erro diretamente no chat se a API Key não estiver configurada
      addMessageToConversation(activeConversationId, {
        text: "Erro: Chave de API não configurada. Por favor, adicione sua chave nas Configurações para interagir com a IA.",
        sender: 'ai',
        metadata: { error: true }
      });
      setText(''); // Limpa o input
      if (textareaRef.current) textareaRef.current.style.height = 'auto'; // Reseta altura
      return;
    }

    // Adiciona a mensagem do usuário à conversa
    addMessageToConversation(activeConversationId, { text: trimmedText, sender: 'user' });

    const currentTextForAI = trimmedText; // Guarda o texto antes de limpar o input
    setText(''); // Limpa o input para o usuário
    setIsLoadingAI(true); // Ativa o estado de loading
    if (textareaRef.current) { // Reseta a altura do textarea
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }

    // Adiciona uma mensagem placeholder para a IA que será atualizada pelo stream
    const aiMessageId = addMessageToConversation(activeConversationId, {
      text: "", // Começa vazia, será preenchida pelo stream
      sender: 'ai',
      metadata: { isLoading: true } // Marca como carregando
    });

    if (!aiMessageId) {
      console.error("Não foi possível criar a mensagem placeholder da IA.");
      setIsLoadingAI(false);
      setErrorFromAI("Erro interno ao tentar preparar a resposta da IA.");
      return;
    }

    let accumulatedResponse = "";
    let finalMemories: string[] = [];
    let streamError: string | null = null;

    try {
      // Prepara o histórico de mensagens para a API, excluindo a placeholder da IA atual
      const conversationHistoryForAPI = activeConversation?.messages
        .filter(msg => msg.id !== aiMessageId) // Exclui a mensagem da IA que está sendo streamada
        .map(msg => ({ sender: msg.sender, text: msg.text })) || [];


      for await (const streamResponse of streamMessageToGemini(
        settings.apiKey,
        conversationHistoryForAPI, // Histórico sem a mensagem atual do usuário (já que o serviço a adiciona)
        currentTextForAI,          // Mensagem atual do usuário
        globalMemories.map(mem => mem.content)
      )) {
        if (streamResponse.delta) {
          accumulatedResponse += streamResponse.delta;
          updateMessageInConversation(activeConversationId, aiMessageId, {
            text: accumulatedResponse + "▍", // Adiciona um cursor de digitação simples
            metadata: { isLoading: true }
          });
        }
        if (streamResponse.error) {
          streamError = streamResponse.error; // Guarda o erro para tratar após o loop
          break; // Interrompe o stream em caso de erro
        }
        if (streamResponse.isFinished) {
          // Se o stream terminou e houve um erro antes (já tratado), não sobrescreva.
          // A resposta final pode ter texto e memórias mesmo se isFinished for true aqui.
          accumulatedResponse = streamResponse.finalText || accumulatedResponse; // Usa finalText se disponível
          finalMemories = streamResponse.newMemories || [];
          break;
        }
      }

      // Atualização final da mensagem da IA
      if (streamError) {
        updateMessageInConversation(activeConversationId, aiMessageId, {
          text: streamError, // Exibe a mensagem de erro da API
          metadata: { isLoading: false, error: true }
        });
        setErrorFromAI(streamError); // Mostra o erro também perto do input
      } else {
        updateMessageInConversation(activeConversationId, aiMessageId, {
          text: accumulatedResponse, // Texto final sem o cursor
          metadata: { isLoading: false, memorizedItems: finalMemories.length > 0 ? finalMemories : undefined }
        });

        if (finalMemories.length > 0) {
          finalMemories.forEach(memContent => {
            addNewGlobalMemory(memContent);
          });
          console.log("Novas memórias adicionadas:", finalMemories);
        }
      }

    } catch (error: unknown) { // Erro inesperado no lado do cliente ao processar o stream
      console.error("Falha catastrófica ao processar stream com Gemini:", error);
      const clientErrorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu uma falha desconhecida no processamento da resposta.";
      updateMessageInConversation(activeConversationId, aiMessageId, {
        text: clientErrorMessage,
        metadata: { isLoading: false, error: true }
      });
      setErrorFromAI(clientErrorMessage);
    } finally {
      setIsLoadingAI(false); // Desativa o estado de loading
      // Focar novamente no input após a resposta, se não houver erro crítico e a API Key estiver ok
      if (textareaRef.current && settings.apiKey && !streamError && !errorFromAI) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoadingAI) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const canSubmit = text.trim().length > 0 && !!activeConversationId && !isLoadingAI;
  const isInputDisabled = !activeConversationId || !settings.apiKey || isLoadingAI;
  const placeholderText = isLoadingAI
    ? "Gemini está respondendo..."
    : activeConversationId
      ? settings.apiKey ? "Digite sua mensagem... (Shift+Enter para nova linha)" : "Configure sua API Key nas Configurações para conversar."
      : "Selecione ou crie uma conversa para começar.";

  return (
    <div className="px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 border-t border-slate-700/60 bg-slate-800/90 backdrop-blur-sm sticky bottom-0">
      {errorFromAI && (
        <div className="mb-2 p-2 text-xs text-red-400 bg-red-900/30 rounded-md flex items-center gap-2">
          <IoWarningOutline className="flex-shrink-0" />
          <span>{errorFromAI}</span>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex items-end bg-slate-900/80 rounded-xl p-1.5 pr-2 shadow-md focus-within:ring-2 focus-within:ring-blue-500/70 transition-shadow duration-200"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="flex-1 bg-transparent text-slate-100 focus:outline-none px-3 py-2.5 resize-none leading-tight scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
          style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
          disabled={isInputDisabled}
          aria-label="Campo de entrada de mensagem"
        />
        <Button
          type="submit"
          variant="primary"
          className="ml-2 !p-2 sm:!p-2.5 rounded-lg"
          disabled={!canSubmit} // O canSubmit já considera isLoadingAI e activeConversationId
          aria-label="Enviar mensagem"
        >
          {isLoadingAI ? (
            <IoPulseOutline size={18} className="animate-pulse" /> // Removido sm-size, Tailwind lida com responsividade
          ) : (
            <IoSend size={18} />
          )}
        </Button>
      </form>
      {!settings.apiKey && activeConversationId && !isLoadingAI && !errorFromAI && (
        <p className="text-xs text-yellow-400/90 text-center mt-2 px-2">
          Chave de API não configurada. Por favor, adicione sua chave nas <strong className="font-medium">Configurações</strong> para interagir com a IA.
        </p>
      )}
    </div>
  );
};

export default MessageInput;