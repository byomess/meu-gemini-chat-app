// src/components/settings/tabs/DataSettingsTab.tsx
import React from "react";
import { IoTrashOutline, IoChatbubblesOutline } from "react-icons/io5";
import Button from "../../common/Button";
import { useMemories } from "../../../contexts/MemoryContext";
import { useConversations } from "../../../contexts/ConversationContext";

const DataSettingsTab: React.FC = () => {
    const { clearAllMemories, memories } = useMemories();
    const { deleteAllConversations, conversations } = useConversations();

    const handleLocalClearAllMemories = () => {
        if (
            window.confirm(
                "Tem certeza de que deseja apagar TODAS as memórias? Esta ação não pode ser desfeita."
            )
        ) {
            clearAllMemories();
        }
    };

    const handleLocalDeleteAllConversations = () => {
        if (
            window.confirm(
                "Tem certeza de que deseja apagar TODAS as conversas? Esta ação não pode ser desfeita e apagará todo o seu histórico."
            )
        ) {
            deleteAllConversations();
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                    Gerenciamento de Dados
                </h3>
                <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4 shadow">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Apagar todas as memórias
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Remove todas as memórias armazenadas pela IA.
                            </p>
                        </div>
                        <Button
                            variant="danger" // Changed from "secondary" to "danger" for a more destructive tone
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-[180px]"
                            onClick={handleLocalClearAllMemories}
                            disabled={memories.length === 0}
                        >
                            {" "}
                            <IoTrashOutline className="mr-1.5" /> Limpar Memórias{" "}
                        </Button>
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-medium text-gray-700">
                                Apagar todas as conversas
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Remove todo o seu histórico de conversas.
                            </p>
                        </div>
                        <Button
                            variant="danger" // Changed from "secondary" to "danger" for a more destructive tone
                            className="!text-sm !py-2 !px-4 !font-medium flex-shrink-0 w-full sm:w-[180px]"
                            onClick={handleLocalDeleteAllConversations}
                            disabled={conversations.length === 0}
                        >
                            {" "}
                            <IoChatbubblesOutline className="mr-1.5" /> Limpar Conversas{" "}
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-4 text-center">
                    Todas as ações de exclusão de dados são irreversíveis.
                </p>
            </div>
        </div>
    );
};

export default DataSettingsTab;
