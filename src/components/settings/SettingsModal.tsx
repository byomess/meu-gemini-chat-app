// src/components/settings/SettingsModal.tsx
import React, { useState, useEffect } from 'react';
import { IoClose, IoTrashOutline, IoInformationCircleOutline } from 'react-icons/io5';
import Button from '../common/Button';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useMemories } from '../../contexts/MemoryContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, saveApiKey } = useAppSettings();
  const { memories, deleteMemory, clearAllMemories } = useMemories();

  const [currentApiKey, setCurrentApiKey] = useState<string>('');

  useEffect(() => {
    // Quando o modal for aberto ou a chave nas configurações globais mudar,
    // atualize o estado local do input.
    if (isOpen) {
      setCurrentApiKey(settings.apiKey);
    }
  }, [settings.apiKey, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    saveApiKey(currentApiKey);
    onClose();
  };

  const handleClearAllMemories = () => {
    // Adicionar uma confirmação seria uma boa prática em uma aplicação real
    if (window.confirm('Tem certeza de que deseja apagar todas as memórias? Esta ação não pode ser desfeita.')) {
      clearAllMemories();
    }
  };

  const handleDeleteMemory = (id: string) => {
    // Adicionar uma confirmação seria uma boa prática
    if (window.confirm('Tem certeza de que deseja apagar esta memória?')) {
      deleteMemory(id);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out animate-fadeIn">
      <div className="bg-slate-800 p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-lg text-slate-100 relative transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalEnter">
        <Button
          onClick={onClose}
          className="!absolute top-3.5 right-3.5 !p-1.5 text-slate-400 hover:text-slate-100 rounded-full hover:bg-slate-700/70"
          variant="secondary"
          aria-label="Fechar modal de configurações"
        >
          <IoClose size={22} />
        </Button>

        <h2 className="text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 text-center text-slate-100">
          Configurações
        </h2>

        {/* Seção da Chave de API */}
        <div className="mb-6 sm:mb-8">
          <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1.5">
            Chave da API Google Gemini
          </label>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            placeholder="Cole sua chave da API aqui"
            value={currentApiKey}
            onChange={(e) => setCurrentApiKey(e.target.value)}
            className="w-full p-2.5 bg-slate-700/80 border border-slate-600/80 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500 text-slate-100 shadow-sm"
          />
          <p className="text-xs text-slate-400 mt-2">
            Sua chave de API é armazenada localmente e usada apenas para interagir com o Google Gemini.
          </p>
        </div>

        {/* Seção de Memórias */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium text-slate-200">Memórias da IA</h3>
            {memories.length > 0 && (
              <Button
                variant="danger"
                className="!text-xs !py-1.5 !px-3 !font-medium"
                onClick={handleClearAllMemories}
              >
                <IoTrashOutline className="mr-1.5 inline" />
                Limpar Tudo
              </Button>
            )}
          </div>
          {memories.length > 0 ? (
            <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-slate-900/60 rounded-lg scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent border border-slate-700/50">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="flex items-center justify-between p-2.5 bg-slate-700/80 rounded-md hover:bg-slate-600/80 transition-colors duration-150"
                >
                  <p className="text-sm text-slate-200 flex-grow mr-2 break-all">{memory.content}</p>
                  <Button
                    variant="secondary"
                    className="!p-1.5 !text-xs text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-md"
                    title="Excluir memória"
                    onClick={() => handleDeleteMemory(memory.id)}
                  >
                    <IoTrashOutline size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center bg-slate-900/60 rounded-lg border border-slate-700/50">
              <IoInformationCircleOutline size={28} className="mx-auto text-slate-500 mb-2" />
              <p className="text-sm text-slate-400">Nenhuma memória armazenada ainda.</p>
              <p className="text-xs text-slate-500 mt-1">Memórias serão adicionadas automaticamente pela IA.</p>
            </div>
          )}
        </div>

        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto !py-2.5">
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} className="w-full sm:w-auto !py-2.5">
            Salvar Alterações
          </Button>
        </div>
      </div>
      {/* Animações CSS (fadeIn para o overlay, modalEnter para o conteúdo do modal) */}
      {/* Estas animações podem ser movidas para um arquivo CSS global ou tailwind.config.js se preferir */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        @keyframes modalEnter {
          0% { transform: scale(0.95) translateY(10px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-modalEnter {
          animation: modalEnter 0.25s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default SettingsModal;