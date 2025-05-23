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
    let iconColorClass = "text-[var(--color-purple-600)]"; // Default icon color
    let labelColorClass = "text-[var(--color-purple-700)] font-semibold"; // Default label color
    let detailsBgClass = "bg-[color:color-mix(in_srgb,var(--color-purple-500)_5%,transparent)]"; // Default details background
    let detailsTextColorClass = "text-[var(--color-purple-800)]"; // Default details text

    if (memoryActionDetail.action === 'created') {
        ActionIconComponent = IoCreateOutline;
        actionLabel = "Nova memória criada:";
        iconColorClass = "text-[var(--color-green-500)]";
        labelColorClass = "text-[var(--color-emerald-600)] font-semibold";
        detailsBgClass = "bg-[color:color-mix(in_srgb,var(--color-green-500)_5%,transparent)]";
        detailsTextColorClass = "text-[var(--color-green-800)]"; // Assuming green-800 is a darker green text
    } else if (memoryActionDetail.action === 'updated') {
        ActionIconComponent = IoInformationCircleOutline;
        actionLabel = "Memória atualizada:";
        iconColorClass = "text-[var(--color-primary)]";
        labelColorClass = "text-[var(--color-primary-dark)] font-semibold";
        detailsBgClass = "bg-[color:color-mix(in_srgb,var(--color-primary)_5%,transparent)]";
        detailsTextColorClass = "text-[var(--color-primary-dark)]";
    } else if (memoryActionDetail.action === 'deleted_by_ai') {
        ActionIconComponent = IoRemoveCircleOutline;
        actionLabel = "Memória removida (IA):";
        iconColorClass = "text-[var(--color-amber-600)]";
        labelColorClass = "text-[var(--color-amber-700)] font-semibold";
        detailsBgClass = "bg-[var(--color-amber-50)]";
        detailsTextColorClass = "text-[var(--color-amber-800)]";
    }

    const baseMemoryText = memoryActionDetail.originalContent || memoryActionDetail.content;
    // If memory exists in context and we are not editing, use its current content. Otherwise, use action detail content.
    const finalDisplayText = (memoryExistsInContext && !isEditingMemory) ? currentMemoryInContext.content : (memoryActionDetail.content || baseMemoryText);


    // Case: Memory was part of the action, but has since been deleted by the user from global memory context
    if (!memoryExistsInContext && memoryActionDetail.action !== 'deleted_by_ai' && !isEditingMemory) {
        return (
            <li className="flex items-start text-[var(--color-gray-500)] italic py-1.5 px-2 -mx-1 text-xs border-l-2 border-[var(--color-gray-300)] pl-3">
                <ActionIconComponent className={`mr-2 mt-0.5 flex-shrink-0 ${iconColorClass}`} size={15} />
                <div className="flex-1 min-w-0">
                    <span className={`font-medium block ${labelColorClass}`}>{actionLabel}</span>
                    <p className="line-through whitespace-pre-wrap break-words opacity-80 text-[var(--color-gray-600)]">
                        "{baseMemoryText}" (removida pelo usuário)
                    </p>
                </div>
            </li>
        );
    }

    return (
        <li className="group/memory-item flex flex-col py-1.5 hover:bg-[var(--color-gray-100)] rounded-md px-2 -mx-2 border-l-2 border-[var(--color-gray-300)] pl-3 transition-colors">
            <div className="flex items-start justify-between w-full">
                <div className={`flex items-start text-xs ${iconColorClass} flex-grow min-w-0`}>
                    <ActionIconComponent className="mr-2 mt-0.5 flex-shrink-0" size={15} />
                    <div className="flex-1 min-w-0">
                        <span className={`block ${labelColorClass}`}>{actionLabel}</span>
                        {!showDetails && !isEditingMemory && (
                            <p className="truncate whitespace-nowrap text-[var(--color-gray-600)]">
                                {memoryActionDetail.action === 'updated' ? `De: "${memoryActionDetail.originalContent}" Para: "${finalDisplayText}"` : `"${finalDisplayText}"`}
                            </p>
                        )}
                    </div>
                </div>
                {!isEditingMemory && memoryActionDetail.action !== 'deleted_by_ai' && memoryExistsInContext && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/memory-item:opacity-100 transition-opacity flex-shrink-0 ml-2">
                        <Button variant="icon" onClick={handleEditMemory} className="!p-1 text-[var(--color-gray-500)] hover:!text-[var(--color-primary)] hover:!bg-[var(--color-gray-100)]" title="Editar esta memória no sistema"> <IoPencilOutline size={14} /> </Button>
                        <Button variant="icon" onClick={handleDeleteUserMemory} className="!p-1 text-[var(--color-gray-500)] hover:!text-[var(--color-red-600)] hover:!bg-[var(--color-red-100)]" title="Excluir esta memória do sistema"> <IoTrashBinOutline size={14} /> </Button>
                    </div>
                )}
                {!isEditingMemory && (
                    <Button variant='icon' onClick={() => setShowDetails(!showDetails)} className='!p-1 text-[var(--color-gray-500)] hover:!text-[var(--color-gray-700)] hover:!bg-[var(--color-gray-100)] ml-1 flex-shrink-0' title={showDetails ? "Esconder detalhes" : "Mostrar detalhes"}>
                        {showDetails ? <IoChevronUpOutline size={16} /> : <IoChevronDownOutline size={16} />}
                    </Button>
                )}
            </div>

            {(showDetails || isEditingMemory) && (
                <div className="mt-1.5 pl-[23px] w-full">
                    {isEditingMemory && currentMemoryInContext ? (
                        <div className="flex-grow flex items-center gap-1.5 w-full bg-[var(--color-input-form-bg)] p-2 rounded-md border border-[var(--color-input-form-border)] shadow-sm">
                            <input
                                type="text"
                                value={editedMemoryContent}
                                onChange={(e) => setEditedMemoryContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveMemoryEdit(); }
                                    if (e.key === 'Escape') { e.preventDefault(); handleCancelMemoryEdit(); }
                                }}
                                className="flex-grow text-xs bg-[var(--color-input-form-bg)] text-[var(--color-input-text)] p-1.5 rounded border border-[var(--color-input-form-border)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                                autoFocus
                            />
                            <Button variant='icon' onClick={handleSaveMemoryEdit} className="!p-1.5 text-[var(--color-green-500)] hover:!text-[var(--color-emerald-600)] [background-color:color-mix(in_srgb,var(--color-green-500)_10%,transparent)] hover:[background-color:color-mix(in_srgb,var(--color-green-500)_20%,transparent)]" title="Salvar (Enter)"> <IoCheckmarkOutline size={16} /> </Button>
                            <Button variant='icon' onClick={handleCancelMemoryEdit} className="!p-1.5 text-[var(--color-gray-600)] hover:!text-[var(--color-gray-700)] !bg-[var(--color-gray-200)] hover:!bg-[var(--color-gray-100)]" title="Cancelar (Esc)"> <IoCloseOutline size={16} /> </Button>
                        </div>
                    ) : (
                        <div className={`text-xs ${detailsTextColorClass} whitespace-pre-wrap break-words ${detailsBgClass} p-2 rounded-md border border-opacity-50 ${
                            memoryActionDetail.action === 'created' ? 'border-[color:color-mix(in_srgb,var(--color-green-500)_20%,transparent)]' :
                            memoryActionDetail.action === 'updated' ? 'border-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)]' :
                            memoryActionDetail.action === 'deleted_by_ai' ? 'border-[var(--color-amber-200)]' : 'border-[color:color-mix(in_srgb,var(--color-purple-500)_20%,transparent)]'
                        }`}>
                            {memoryActionDetail.action === 'updated' ? (
                                <>
                                    <p><strong className={`font-medium ${
                                        memoryActionDetail.action === 'updated' ? 'text-[var(--color-primary-dark)]' : 'text-[var(--color-gray-600)]'
                                    }`}>Original:</strong> "{memoryActionDetail.originalContent}"</p>
                                    <p><strong className={`font-medium ${
                                        memoryActionDetail.action === 'updated' ? 'text-[var(--color-primary-dark)]' : 'text-[var(--color-gray-600)]'
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
