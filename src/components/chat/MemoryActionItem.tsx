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
            setEditedMemoryContent(memoryActionDetail.content);
        }
    }, [currentMemoryInContext, isEditingMemory, memoryActionDetail.content, memoryActionDetail.action]);

    const memoryExistsInContext = !!currentMemoryInContext;

    const handleEditMemory = () => {
        if (!currentMemoryInContext) return;
        setEditedMemoryContent(currentMemoryInContext.content);
        setIsEditingMemory(true);
        setShowDetails(true);
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
        setIsEditingMemory(false);
    };

    let ActionIconComponent = IoGitNetworkOutline;
    let actionLabel = "";
    let colorClass = "text-purple-400";

    if (memoryActionDetail.action === 'created') {
        ActionIconComponent = IoCreateOutline;
        actionLabel = "Nova memória criada:";
        colorClass = "text-green-400";
    } else if (memoryActionDetail.action === 'updated') {
        ActionIconComponent = IoInformationCircleOutline;
        actionLabel = "Memória atualizada:";
        colorClass = "text-sky-400";
    } else if (memoryActionDetail.action === 'deleted_by_ai') {
        ActionIconComponent = IoRemoveCircleOutline;
        actionLabel = "Memória removida:";
        colorClass = "text-amber-400";
    }

    const baseMemoryText = memoryActionDetail.originalContent || memoryActionDetail.content;
    const finalDisplayText = memoryActionDetail.action === 'updated' && memoryExistsInContext ? currentMemoryInContext.content : (memoryActionDetail.content || baseMemoryText);


    if (!memoryExistsInContext && memoryActionDetail.action !== 'deleted_by_ai' && !isEditingMemory) {
        return (
            <li className="flex items-start text-slate-500/80 italic py-1.5 px-2 -mx-1 text-xs border-l-2 border-slate-700/50 pl-3">
                <ActionIconComponent className={`mr-2 mt-0.5 flex-shrink-0 ${colorClass}`} size={15} />
                <div className="flex-1 min-w-0">
                    <span className="font-medium block">{actionLabel}</span>
                    <p className="line-through whitespace-pre-wrap break-words opacity-80">
                        "{baseMemoryText}" (removida pelo usuário)
                    </p>
                </div>
            </li>
        );
    }

    return (
        <li className="group/memory-item flex flex-col py-1.5 hover:bg-slate-700/40 rounded-md px-2 -mx-2 border-l-2 border-slate-700/50 pl-3 transition-colors">
            <div className="flex items-start justify-between w-full">
                <div className={`flex items-start text-xs ${colorClass} flex-grow min-w-0`}>
                    <ActionIconComponent className="mr-2 mt-0.5 flex-shrink-0" size={15} />
                    <div className="flex-1 min-w-0">
                        <span className="font-semibold block">{actionLabel}</span>
                        {!showDetails && !isEditingMemory && (
                            <p className="truncate whitespace-nowrap">
                                {memoryActionDetail.action === 'updated' ? `De: "${memoryActionDetail.originalContent}" Para: "${finalDisplayText}"` : `"${finalDisplayText}"`}
                            </p>
                        )}
                    </div>
                </div>
                {!isEditingMemory && memoryActionDetail.action !== 'deleted_by_ai' && memoryExistsInContext && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/memory-item:opacity-100 transition-opacity flex-shrink-0 ml-2">
                        <Button variant="icon" onClick={handleEditMemory} className="!p-1 text-purple-400 hover:!text-purple-300 hover:!bg-slate-600/50" title="Editar esta memória no sistema"> <IoPencilOutline size={14} /> </Button>
                        <Button variant="icon" onClick={handleDeleteUserMemory} className="!p-1 text-red-500 hover:!text-red-400 hover:!bg-slate-600/50" title="Excluir esta memória do sistema"> <IoTrashBinOutline size={14} /> </Button>
                    </div>
                )}
                {!isEditingMemory && (
                    <Button variant='icon' onClick={() => setShowDetails(!showDetails)} className='!p-1 text-slate-400 hover:!text-slate-200 hover:!bg-slate-600/50 ml-1 flex-shrink-0' title={showDetails ? "Esconder detalhes" : "Mostrar detalhes"}>
                        {showDetails ? <IoChevronUpOutline size={16} /> : <IoChevronDownOutline size={16} />}
                    </Button>
                )}
            </div>

            {(showDetails || isEditingMemory) && (
                <div className="mt-1.5 pl-[23px] w-full">
                    {isEditingMemory && currentMemoryInContext ? (
                        <div className="flex-grow flex items-center gap-1.5 w-full bg-slate-700/50 p-2 rounded-md border border-slate-600">
                            <input
                                type="text"
                                value={editedMemoryContent}
                                onChange={(e) => setEditedMemoryContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveMemoryEdit(); }
                                    if (e.key === 'Escape') { e.preventDefault(); handleCancelMemoryEdit(); }
                                }}
                                className="flex-grow text-xs bg-slate-800/70 text-slate-100 p-1.5 rounded border border-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                autoFocus
                            />
                            <Button variant='icon' onClick={handleSaveMemoryEdit} className="!p-1.5 text-green-400 hover:!text-green-300 !bg-slate-600 hover:!bg-slate-500" title="Salvar (Enter)"> <IoCheckmarkOutline size={16} /> </Button>
                            <Button variant='icon' onClick={handleCancelMemoryEdit} className="!p-1.5 text-slate-300 hover:!text-slate-100 !bg-slate-600 hover:!bg-slate-500" title="Cancelar (Esc)"> <IoCloseOutline size={16} /> </Button>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-300/90 whitespace-pre-wrap break-words bg-slate-700/30 p-2 rounded-md">
                            {memoryActionDetail.action === 'updated' && (
                                <>
                                    <p><strong className='text-slate-400 font-medium'>Original:</strong> "{memoryActionDetail.originalContent}"</p>
                                    <p><strong className='text-slate-400 font-medium'>Atualizado para:</strong> "{finalDisplayText}"</p>
                                </>
                            )}
                            {memoryActionDetail.action !== 'updated' && (
                                <p>"{finalDisplayText}"</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </li>
    );
};