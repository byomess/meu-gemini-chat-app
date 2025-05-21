import Button from "../common/Button";
import React, { useState, useEffect } from "react";
import { IoGitNetworkOutline, IoCreateOutline, IoInformationCircleOutline, IoRemoveCircleOutline, IoPencilOutline, IoTrashBinOutline, IoChevronUpOutline, IoChevronDownOutline, IoCheckmarkOutline, IoCloseOutline } from "react-icons/io5";
import { useMemories } from "../../contexts/MemoryContext";
import type { MessageMetadata } from "../../types";

interface MemoryActionItemProps {
    memoryActionDetail: NonNullable<MessageMetadata['memorizedMemoryActions']>[0];
}

export const MemoryActionItem: React.FC<MemoryActionItemProps> = ({ memoryActionDetail }) => {
    const { memories, updateMemory, deleteMemory } = useMemories();
    const [isEditingMemory, setIsEditingMemory] = useState(false);
    const currentMemoryInContext = memories.find(m => m.id === memoryActionDetail.id);
    const [editedMemoryContent, setEditedMemoryContent] = useState(
        currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content
    );
    const [showDetails, setShowDetails] = useState(false);


    useEffect(() => {
        if (currentMemoryInContext && !isEditingMemory) {
            setEditedMemoryContent(currentMemoryInContext.content);
        } else if (!currentMemoryInContext && !isEditingMemory && memoryActionDetail.action !== 'deleted_by_ai') {
            // If memory was deleted from context but action is not 'deleted_by_ai' (e.g. user deleted it manually from settings)
            // and we are not editing, reflect the original content from the action detail.
            setEditedMemoryContent(memoryActionDetail.content);
        }
    }, [currentMemoryInContext, isEditingMemory, memoryActionDetail.content, memoryActionDetail.action]);

    const memoryExistsInContext = !!currentMemoryInContext;

    const handleEditMemory = () => {
        if (!currentMemoryInContext) return;
        setEditedMemoryContent(currentMemoryInContext.content);
        setIsEditingMemory(true);
        setShowDetails(true); // Ensure details are shown when editing starts
    };

    const handleSaveMemoryEdit = () => {
        if (!currentMemoryInContext) return;
        const trimmedContent = editedMemoryContent.trim();
        if (trimmedContent && trimmedContent !== currentMemoryInContext.content) {
            updateMemory(memoryActionDetail.id, trimmedContent);
        } else if (!trimmedContent && currentMemoryInContext.content) {
            if (window.confirm(`O conteúdo da memória "${currentMemoryInContext.content}" está vazio. Deseja excluir esta memória?`)) {
                deleteMemory(memoryActionDetail.id);
            }
        }
        setIsEditingMemory(false);
    };

    const handleCancelMemoryEdit = () => {
        setEditedMemoryContent(currentMemoryInContext ? currentMemoryInContext.content : memoryActionDetail.content);
        setIsEditingMemory(false);
    };

    const handleDeleteUserMemory = () => {
        if (!currentMemoryInContext) return;
        if (window.confirm(`Tem certeza que deseja excluir a memória: "${currentMemoryInContext.content}"? Esta ação afeta o armazenamento global de memórias.`)) {
            deleteMemory(memoryActionDetail.id);
        }
        setIsEditingMemory(false); // Ensure editing mode is exited
    };

    let ActionIconComponent = IoGitNetworkOutline;
    let actionLabel = "";
    let iconColorClass = "text-purple-600"; // Default icon color
    let labelColorClass = "text-purple-700 font-semibold"; // Default label color
    let detailsBgClass = "bg-purple-50"; // Default details background
    let detailsTextColorClass = "text-purple-800"; // Default details text

    if (memoryActionDetail.action === 'created') {
        ActionIconComponent = IoCreateOutline;
        actionLabel = "Nova memória criada:";
        iconColorClass = "text-green-600";
        labelColorClass = "text-green-700 font-semibold";
        detailsBgClass = "bg-green-50";
        detailsTextColorClass = "text-green-800";
    } else if (memoryActionDetail.action === 'updated') {
        ActionIconComponent = IoInformationCircleOutline;
        actionLabel = "Memória atualizada:";
        iconColorClass = "text-blue-600";
        labelColorClass = "text-blue-700 font-semibold";
        detailsBgClass = "bg-blue-50";
        detailsTextColorClass = "text-blue-800";
    } else if (memoryActionDetail.action === 'deleted_by_ai') {
        ActionIconComponent = IoRemoveCircleOutline;
        actionLabel = "Memória removida (IA):";
        iconColorClass = "text-amber-600";
        labelColorClass = "text-amber-700 font-semibold";
        detailsBgClass = "bg-amber-50";
        detailsTextColorClass = "text-amber-800";
    }

    const baseMemoryText = memoryActionDetail.originalContent || memoryActionDetail.content;
    // If memory exists in context and we are not editing, use its current content. Otherwise, use action detail content.
    const finalDisplayText = (memoryExistsInContext && !isEditingMemory) ? currentMemoryInContext.content : (memoryActionDetail.content || baseMemoryText);


    // Case: Memory was part of the action, but has since been deleted by the user from global memory context
    if (!memoryExistsInContext && memoryActionDetail.action !== 'deleted_by_ai' && !isEditingMemory) {
        return (
            <li className="flex items-start text-gray-500 italic py-1.5 px-2 -mx-1 text-xs border-l-2 border-gray-300 pl-3">
                <ActionIconComponent className={`mr-2 mt-0.5 flex-shrink-0 ${iconColorClass}`} size={15} />
                <div className="flex-1 min-w-0">
                    <span className={`font-medium block ${labelColorClass}`}>{actionLabel}</span>
                    <p className="line-through whitespace-pre-wrap break-words opacity-80">
                        "{baseMemoryText}" (removida pelo usuário)
                    </p>
                </div>
            </li>
        );
    }

    return (
        <li className="group/memory-item flex flex-col py-1.5 hover:bg-gray-100 rounded-md px-2 -mx-2 border-l-2 border-gray-300 pl-3 transition-colors">
            <div className="flex items-start justify-between w-full">
                <div className={`flex items-start text-xs ${iconColorClass} flex-grow min-w-0`}>
                    <ActionIconComponent className="mr-2 mt-0.5 flex-shrink-0" size={15} />
                    <div className="flex-1 min-w-0">
                        <span className={`block ${labelColorClass}`}>{actionLabel}</span>
                        {!showDetails && !isEditingMemory && (
                            <p className="truncate whitespace-nowrap text-gray-600">
                                {memoryActionDetail.action === 'updated' ? `De: "${memoryActionDetail.originalContent}" Para: "${finalDisplayText}"` : `"${finalDisplayText}"`}
                            </p>
                        )}
                    </div>
                </div>
                {!isEditingMemory && memoryActionDetail.action !== 'deleted_by_ai' && memoryExistsInContext && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/memory-item:opacity-100 transition-opacity flex-shrink-0 ml-2">
                        <Button variant="icon" onClick={handleEditMemory} className="!p-1 text-gray-500 hover:!text-[#e04579] hover:!bg-pink-100" title="Editar esta memória no sistema"> <IoPencilOutline size={14} /> </Button>
                        <Button variant="icon" onClick={handleDeleteUserMemory} className="!p-1 text-gray-500 hover:!text-red-600 hover:!bg-red-100" title="Excluir esta memória do sistema"> <IoTrashBinOutline size={14} /> </Button>
                    </div>
                )}
                {!isEditingMemory && (
                    <Button variant='icon' onClick={() => setShowDetails(!showDetails)} className='!p-1 text-gray-500 hover:!text-gray-700 hover:!bg-gray-100 ml-1 flex-shrink-0' title={showDetails ? "Esconder detalhes" : "Mostrar detalhes"}>
                        {showDetails ? <IoChevronUpOutline size={16} /> : <IoChevronDownOutline size={16} />}
                    </Button>
                )}
            </div>

            {(showDetails || isEditingMemory) && (
                <div className="mt-1.5 pl-[23px] w-full">
                    {isEditingMemory && currentMemoryInContext ? (
                        <div className="flex-grow flex items-center gap-1.5 w-full bg-white p-2 rounded-md border border-gray-300 shadow-sm">
                            <input
                                type="text"
                                value={editedMemoryContent}
                                onChange={(e) => setEditedMemoryContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveMemoryEdit(); }
                                    if (e.key === 'Escape') { e.preventDefault(); handleCancelMemoryEdit(); }
                                }}
                                className="flex-grow text-xs bg-white text-gray-800 p-1.5 rounded border border-gray-300 focus:outline-none focus:border-[#e04579] focus:ring-1 focus:ring-[#e04579]"
                                autoFocus
                            />
                            <Button variant='icon' onClick={handleSaveMemoryEdit} className="!p-1.5 text-green-600 hover:!text-green-700 !bg-green-100 hover:!bg-green-200" title="Salvar (Enter)"> <IoCheckmarkOutline size={16} /> </Button>
                            <Button variant='icon' onClick={handleCancelMemoryEdit} className="!p-1.5 text-gray-600 hover:!text-gray-800 !bg-gray-200 hover:!bg-gray-300" title="Cancelar (Esc)"> <IoCloseOutline size={16} /> </Button>
                        </div>
                    ) : (
                        <div className={`text-xs ${detailsTextColorClass} whitespace-pre-wrap break-words ${detailsBgClass} p-2 rounded-md border border-opacity-50 ${
                            memoryActionDetail.action === 'created' ? 'border-green-200' :
                            memoryActionDetail.action === 'updated' ? 'border-blue-200' :
                            memoryActionDetail.action === 'deleted_by_ai' ? 'border-amber-200' : 'border-purple-200'
                        }`}>
                            {memoryActionDetail.action === 'updated' ? (
                                <>
                                    <p><strong className={`font-medium ${
                                        memoryActionDetail.action === 'updated' ? 'text-blue-700' : 'text-gray-600'
                                    }`}>Original:</strong> "{memoryActionDetail.originalContent}"</p>
                                    <p><strong className={`font-medium ${
                                        memoryActionDetail.action === 'updated' ? 'text-blue-700' : 'text-gray-600'
                                    }`}>Atualizado para:</strong> "{finalDisplayText}"</p>
                                </>
                            ) : (
                                <p>"{finalDisplayText}"</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </li>
    );
};
