// src/components/settings/tabs/MemoriesSettingsTab.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { IoAddCircleOutline, IoDownloadOutline, IoCloudUploadOutline, IoPencilOutline, IoTrashBinOutline, IoSearchOutline } from "react-icons/io5";
import { LuBrain } from "react-icons/lu";
import Button from "../../common/Button";
import TextInput from "../../common/TextInput"; // Import TextInput
import { useMemories } from "../../../contexts/MemoryContext";
import type { Memory } from "../../../types";
import { useDialog } from "../../../contexts/DialogContext";

const MemoriesSettingsTab: React.FC = () => {
    const {
        memories,
        addMemory,
        deleteMemory,
        updateMemory,
        replaceAllMemories,
    } = useMemories();
    const { showDialog } = useDialog();
    const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
    const [editedMemoryText, setEditedMemoryText] = useState<string>("");
    const [newMemoryText, setNewMemoryText] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const newMemoryInputRef = useRef<HTMLInputElement>(null);
    const editMemoryInputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingMemory && editMemoryInputRef.current) {
            editMemoryInputRef.current.focus();
            editMemoryInputRef.current.select();
        }
    }, [editingMemory]);

    const handleLocalDeleteMemory = (id: string) => {
        showDialog({
            title: "Confirm Deletion",
            message: "Tem certeza de que deseja apagar esta memória?",
            type: "confirm",
            confirmText: "Apagar",
            cancelText: "Cancelar",
            onConfirm: () => {
                deleteMemory(id);
                if (editingMemory?.id === id) {
                    setEditingMemory(null);
                    setEditedMemoryText("");
                }
            },
        });
    };
    const handleStartEditMemory = (memory: Memory) => {
        setEditingMemory(memory);
        setEditedMemoryText(memory.content);
    };
    const handleSaveMemoryEdit = () => {
        if (editingMemory && editedMemoryText.trim()) {
            if (editedMemoryText.trim() !== editingMemory.content) {
                updateMemory(editingMemory.id, editedMemoryText.trim());
            }
            setEditingMemory(null);
            setEditedMemoryText("");
        } else if (editingMemory && !editedMemoryText.trim()) {
            showDialog({
                title: "Validation Error",
                message: "O conteúdo da memória não pode ser vazio.",
                type: "alert",
            });
        }
    };
    const handleCancelMemoryEdit = () => {
        setEditingMemory(null);
        setEditedMemoryText("");
    };
    const handleAddNewMemory = () => {
        if (newMemoryText.trim()) {
            addMemory(newMemoryText.trim());
            setNewMemoryText("");
            if (newMemoryInputRef.current) {
                newMemoryInputRef.current.focus();
            }
        }
    };
    const handleNewMemoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddNewMemory();
        }
    };
    const handleEditMemoryKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSaveMemoryEdit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancelMemoryEdit();
        }
    };
    const handleExportMemories = () => {
        if (memories.length === 0) {
            showDialog({
                title: "Export Error",
                message: "Nenhuma memória para exportar.",
                type: "alert",
            });
            return;
        }
        const jsonString = JSON.stringify(memories, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `loox_chat_memories_${new Date().toISOString().split("T")[0]
            }.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    const handleImportMemories = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result;
                if (typeof content === "string") {
                    const parsedContent: unknown = JSON.parse(content); // Parse as unknown first

                    if (!Array.isArray(parsedContent)) {
                        throw new Error("O arquivo JSON não contém um array.");
                    }

                    const importedMemories: Memory[] = parsedContent.map((item: unknown) => {
                        if (typeof item !== 'object' || item === null) {
                            throw new Error("Item de memória inválido.");
                        }
                        const memoryItem = item as Record<string, unknown>; // Cast to a record to access properties
                        if (
                            typeof memoryItem.id !== "string" ||
                            typeof memoryItem.content !== "string" ||
                            typeof memoryItem.timestamp !== "string"
                        ) {
                            throw new Error("Memória com formato inválido (missing id, content, or timestamp).");
                        }
                        return {
                            id: memoryItem.id,
                            content: memoryItem.content,
                            timestamp: new Date(memoryItem.timestamp), // Convert string to Date
                            sourceMessageId: typeof memoryItem.sourceMessageId === "string" ? memoryItem.sourceMessageId : undefined,
                        };
                    });

                    showDialog({
                        title: "Confirm Import",
                        message: `Isso substituirá ${memories.length > 0
                            ? "TODAS as memórias atuais"
                            : "suas memórias (atualmente vazias)"
                            } por ${importedMemories.length
                            } memórias do arquivo. Deseja continuar?`,
                        type: "confirm",
                        confirmText: "Continuar",
                        cancelText: "Cancelar",
                        onConfirm: () => {
                            replaceAllMemories(importedMemories);
                            showDialog({
                                title: "Import Successful",
                                message: "Memórias importadas com sucesso.",
                                type: "alert",
                            });
                        },
                    });
                }
            } catch (error: unknown) { // Catch unknown error type
                console.error("Erro ao importar memórias:", error);
                showDialog({
                    title: "Import Error",
                    message: `Erro ao importar memórias: ${error instanceof Error
                        ? error.message
                        : "Formato de arquivo inválido."
                        }`,
                    type: "alert",
                });
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };
    const filteredMemories = useMemo(() => {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        return memories
            .filter((memory) =>
                memory.content.toLowerCase().includes(lowercasedSearchTerm)
            )
            .slice()
            .reverse();
    }, [memories, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3 mb-1">
                <h3 className="text-base font-semibold text-[var(--color-settings-section-title-text)] w-full sm:w-auto">
                    Gerenciar Memórias ({memories.length})
                </h3>
                <div className="flex gap-2.5 flex-wrap">
                    <Button
                        variant="secondary"
                        className="!text-xs !py-2 !px-3.5 !font-medium"
                        onClick={handleExportMemories}
                        disabled={memories.length === 0}
                    >
                        {" "}
                        <IoDownloadOutline className="mr-1.5" /> Exportar{" "}
                    </Button>
                    <Button
                        variant="secondary"
                        className="!text-xs !py-2 !px-3.5 !font-medium"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {" "}
                        <IoCloudUploadOutline className="mr-1.5" /> Importar{" "}
                    </Button>
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleImportMemories}
                        className="hidden"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2.5 mt-2">
                <div onKeyDown={handleNewMemoryKeyDown} className="flex-grow">
                    <TextInput
                        ref={newMemoryInputRef}
                        id="newMemory"
                        name="newMemory"
                        value={newMemoryText}
                        onChange={setNewMemoryText}
                        placeholder="Adicionar nova memória..."
                        containerClassName="w-full"
                        inputClassName="p-2.5 text-sm" // Match original styling
                    />
                </div>
                <Button
                    variant="primary"
                    onClick={handleAddNewMemory}
                    className="!py-2.5 !px-3 flex-shrink-0" // Adjusted padding to better match TextInput
                    disabled={!newMemoryText.trim()}
                >
                    {" "}
                    <IoAddCircleOutline size={20} />{" "}
                </Button>
            </div>
            <div className="relative">
                <IoSearchOutline
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-table-item-icon)] pointer-events-none z-10" // Ensure icon is above input
                    size={18}
                />
                <TextInput
                    id="searchMemories"
                    name="searchMemories"
                    placeholder="Buscar memórias..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                    // Add pl-10 to inputClassName to make space for the icon
                    inputClassName="px-2.5 py-1.5 text-sm pl-10" // Match original styling and add padding for icon
                    // containerClassName="w-full" // Ensure TextInput takes full width if needed
                />
            </div>
            {memories.length > 0 ? (
                filteredMemories.length > 0 ? (
                    <div className="overflow-y-auto space-y-2 p-3 bg-[var(--color-table-row-bg)] rounded-lg border border-[var(--color-table-row-border)] max-h-[calc(100vh-480px)] sm:max-h-[calc(100vh-450px)] min-h-[100px]">
                        {filteredMemories.map((memory) => (
                            <div
                                key={memory.id}
                                className="p-2.5 bg-[var(--color-table-row-bg)] rounded-md shadow transition-shadow hover:shadow-md border border-[var(--color-table-row-border)]"
                            >
                                {editingMemory?.id === memory.id ? (
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            value={editedMemoryText}
                                            onChange={(e) => setEditedMemoryText(e.target.value)}
                                            onKeyDown={handleEditMemoryKeyDown}
                                            ref={editMemoryInputRef}
                                            rows={3}
                                            className="w-full p-2 bg-[var(--color-table-item-edit-bg)] border border-[var(--color-table-item-edit-border)] rounded text-xs text-[var(--color-table-item-edit-text)] focus:border-[var(--color-text-input-focus-border)] focus:ring-1 focus:ring-[var(--color-text-input-focus-ring)] resize-y min-h-[40px]"
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <Button
                                                variant="secondary"
                                                onClick={handleCancelMemoryEdit}
                                                className="!text-xs !py-1 !px-2.5"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={handleSaveMemoryEdit}
                                                className="!text-xs !py-1 !px-2.5"
                                            >
                                                Salvar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs text-[var(--color-table-item-text)] flex-grow break-words py-0.5 pr-1 whitespace-pre-wrap">
                                            {memory.content}
                                        </p>
                                        <div className="flex-shrink-0 flex items-center gap-1">
                                            <Button
                                                variant="icon"
                                                className="!p-1.5 text-[var(--color-table-item-icon)] hover:!text-[var(--color-primary)] hover:!bg-[var(--color-pink-50)]"
                                                title="Editar memória"
                                                onClick={() => handleStartEditMemory(memory)}
                                            >
                                                {" "}
                                                <IoPencilOutline size={15} />{" "}
                                            </Button>
                                            <Button
                                                variant="icon"
                                                className="!p-1.5 text-[var(--color-table-item-icon)] hover:!text-[var(--color-red-500)] hover:!bg-[var(--color-red-100)]"
                                                title="Excluir memória"
                                                onClick={() => handleLocalDeleteMemory(memory.id)}
                                            >
                                                {" "}
                                                <IoTrashBinOutline size={15} />{" "}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 text-center bg-[var(--color-table-row-bg)] rounded-lg border border-[var(--color-table-row-border)]">
                        <IoSearchOutline
                            size={28}
                            className="mx-auto text-[var(--color-table-item-icon)] mb-2"
                        />
                        <p className="text-sm text-[var(--color-settings-section-description-text)]">
                            Nenhuma memória encontrada para "{searchTerm}".
                        </p>
                        <p className="text-xs text-[var(--color-table-item-icon)] mt-1">
                            Tente um termo de busca diferente ou limpe a busca.
                        </p>
                    </div>
                )
            ) : (
                <div className="p-4 text-center bg-[var(--color-table-row-bg)] rounded-lg border border-[var(--color-table-row-border)]">
                    <LuBrain size={28} className="mx-auto text-[var(--color-table-item-icon)] mb-2" />
                    <p className="text-sm text-[var(--color-settings-section-description-text)]">Nenhuma memória armazenada.</p>
                    <p className="text-xs text-[var(--color-table-item-icon)] mt-1">
                        Adicione memórias para personalizar suas interações.
                    </p>
                </div>
            )}
        </div>
    );
};

export default MemoriesSettingsTab;
