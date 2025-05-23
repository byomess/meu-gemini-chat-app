// src/components/settings/tabs/FunctionCallingSettingsTab.tsx
import React, { useState, useCallback, useRef } from 'react';
import Button from '../../common/Button';
import TextInput from '../../common/TextInput';
import { IoAddCircleOutline, IoTrashOutline, IoPencilOutline, IoCheckmarkOutline, IoCloseOutline, IoArrowUpCircleOutline, IoArrowDownCircleOutline, IoInformationCircleOutline } from 'react-icons/io5';
import {type  FunctionDeclaration } from '../../../types'; // Import FunctionDeclaration
import { useDialog } from '../../../contexts/DialogContext';
import SettingsCard from '../../common/SettingsCard'; // Import the new SettingsCard
import SettingsPanel from '../SettingsPanel'; // Import the new SettingsPanel
import Tooltip from '../../common/Tooltip'; // Import Tooltip for select elements

export interface FunctionCallingSettingsTabProps {
    currentFunctionDeclarations: FunctionDeclaration[];
    setCurrentFunctionDeclarations: (declarations: FunctionDeclaration[]) => void;
}

const FunctionCallingSettingsTab: React.FC<FunctionCallingSettingsTabProps> = ({
    currentFunctionDeclarations,
    setCurrentFunctionDeclarations,
}) => {
    const { showDialog } = useDialog();
    const [editingFunctionId, setEditingFunctionId] = useState<string | null>(null);
    const [newFunction, setNewFunction] = useState<FunctionDeclaration>({ // Use FunctionDeclaration directly
        id: '',
        name: '',
        description: '',
        parametersSchema: '',
        endpointUrl: '',
        httpMethod: 'POST',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddFunction = useCallback(() => {
        setEditingFunctionId('new');
        setNewFunction({
            id: crypto.randomUUID(),
            name: '',
            description: '',
            parametersSchema: '',
            endpointUrl: '',
            httpMethod: 'POST',
        });
    }, []);

    const handleSaveFunction = useCallback(() => {
        if (!newFunction.name || !newFunction.description || !newFunction.parametersSchema || !newFunction.endpointUrl) {
            showDialog({
                title: "Campos Obrigatórios",
                message: "Por favor, preencha todos os campos para a declaração da função.",
                type: "alert",
            });
            return;
        }

        try {
            JSON.parse(newFunction.parametersSchema);
        } catch (e: unknown) { // Catch unknown error type
            showDialog({
                title: "Schema Inválido",
                message: `O 'Schema de Parâmetros' deve ser um JSON válido. Detalhes: ${e instanceof Error ? e.message : String(e)}`,
                type: "alert",
            });
            return;
        }

        if (editingFunctionId === 'new') {
            setCurrentFunctionDeclarations([...currentFunctionDeclarations, newFunction]);
        } else if (editingFunctionId) {
            setCurrentFunctionDeclarations(currentFunctionDeclarations.map(f =>
                f.id === editingFunctionId ? newFunction : f
            ));
        }
        setEditingFunctionId(null);
        setNewFunction({
            id: '',
            name: '',
            description: '',
            parametersSchema: '',
            endpointUrl: '',
            httpMethod: 'POST',
        });
    }, [newFunction, editingFunctionId, currentFunctionDeclarations, setCurrentFunctionDeclarations, showDialog]);

    const handleEditFunction = useCallback((func: FunctionDeclaration) => {
        setEditingFunctionId(func.id);
        setNewFunction({ ...func });
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingFunctionId(null);
        setNewFunction({
            id: '',
            name: '',
            description: '',
            parametersSchema: '',
            endpointUrl: '',
            httpMethod: 'POST',
        });
    }, []);

    const handleDeleteFunction = useCallback((id: string) => {
        showDialog({
            title: "Confirmar Exclusão",
            message: "Tem certeza de que deseja excluir esta declaração de função?",
            type: "confirm",
            confirmText: "Excluir",
            cancelText: "Cancelar",
            onConfirm: () => {
                setCurrentFunctionDeclarations(currentFunctionDeclarations.filter(f => f.id !== id));
            }
        });
    }, [currentFunctionDeclarations, setCurrentFunctionDeclarations, showDialog]);

    const handleExportFunctions = useCallback(() => {
        const dataStr = JSON.stringify(currentFunctionDeclarations, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'function_declarations.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [currentFunctionDeclarations]);

    const handleImportFunctions = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedData: FunctionDeclaration[] = JSON.parse(content);

                // Basic validation for imported data structure
                if (!Array.isArray(importedData) || !importedData.every(item =>
                    typeof item === 'object' && item !== null &&
                    'id' in item && typeof item.id === 'string' &&
                    'name' in item && typeof item.name === 'string' &&
                    'description' in item && typeof item.description === 'string' &&
                    'parametersSchema' in item && typeof item.parametersSchema === 'string' &&
                    'endpointUrl' in item && typeof item.endpointUrl === 'string' &&
                    'httpMethod' in item && typeof item.httpMethod === 'string'
                )) {
                    showDialog({
                        title: "Erro de Importação",
                        message: "O arquivo JSON não contém uma lista válida de declarações de função. Verifique a estrutura.",
                        type: "alert",
                    });
                    return;
                }

                // Ensure unique IDs for imported functions to prevent conflicts
                const existingIds = new Set(currentFunctionDeclarations.map(f => f.id));
                const functionsToImport = importedData.map(func => ({
                    ...func,
                    id: existingIds.has(func.id) ? crypto.randomUUID() : func.id // Generate new ID if conflict
                }));

                setCurrentFunctionDeclarations([...currentFunctionDeclarations, ...functionsToImport]);
                showDialog({
                    title: "Importação Concluída",
                    message: `Foram importadas ${functionsToImport.length} declarações de função.`,
                    type: "alert",
                });
            } catch (error: unknown) {
                showDialog({
                    title: "Erro de Leitura",
                    message: `Não foi possível ler o arquivo ou o JSON é inválido. Detalhes: ${error instanceof Error ? error.message : String(error)}`,
                    type: "alert",
                });
            }
        };
        reader.readAsText(file);
        // Reset file input value to allow re-importing the same file
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [currentFunctionDeclarations, setCurrentFunctionDeclarations, showDialog]);


    return (
        <div className="space-y-6">
            <SettingsPanel
                title="Chamada de Função"
                description="Defina funções personalizadas que a IA pode chamar para interagir com serviços externos. Certifique-se de que o 'Schema de Parâmetros' seja um JSON Schema válido."
            >
                {/* New button section */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4">
                    <Button
                        variant="primary"
                        onClick={handleAddFunction}
                        className="w-full sm:w-auto"
                        disabled={!!editingFunctionId} // Disable if editing or adding
                        size="sm" // Reduced size
                    >
                        <IoAddCircleOutline className="mr-2" size={20} /> Adicionar
                    </Button>
                    <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
                        <Button variant="secondary" onClick={handleExportFunctions} className="w-full sm:w-auto" size="sm"> {/* Reduced size */}
                            <IoArrowDownCircleOutline className="mr-2" size={20} /> Exportar
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportFunctions}
                            accept=".json"
                            className="hidden"
                        />
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto" size="sm"> {/* Reduced size */}
                            <IoArrowUpCircleOutline className="mr-2" size={20} /> Importar
                        </Button>
                    </div>
                </div>

                <div className="space-y-4">
                    {currentFunctionDeclarations.map((func) => (
                        <SettingsCard
                            key={func.id}
                            isEditing={editingFunctionId === func.id}
                            editForm={
                                <div className="flex flex-col space-y-3 p-4">
                                    <TextInput
                                        id={`name-${func.id}`}
                                        name="name"
                                        label="Nome da Função"
                                        tooltipContent="O nome único da função que a IA usará para chamá-la. Deve ser descritivo e em camelCase."
                                        value={newFunction.name}
                                        onChange={(val) => setNewFunction(prev => ({ ...prev, name: val }))}
                                        placeholder="Ex: getWeather"
                                        inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                    />
                                    <TextInput
                                        id={`description-${func.id}`}
                                        name="description"
                                        label="Descrição"
                                        tooltipContent="Uma breve descrição do que a função faz. Isso ajuda a IA a decidir quando usar a função."
                                        value={newFunction.description}
                                        onChange={(val) => setNewFunction(prev => ({ ...prev, description: val }))}
                                        placeholder="Ex: Obtém a previsão do tempo para uma cidade"
                                        inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                    />
                                    <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                                        <div className="flex-1">
                                            <div className="flex items-center mb-1.5">
                                                <Tooltip content="O método HTTP a ser usado para a requisição ao endpoint da função.">
                                                    <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                                                </Tooltip>
                                                <label htmlFor={`method-${func.id}`} className="block text-sm font-medium text-[var(--color-text-input-label-text)]">Método HTTP</label>
                                            </div>
                                            <select
                                                id={`method-${func.id}`}
                                                name="httpMethod"
                                                value={newFunction.httpMethod}
                                                onChange={(e) => setNewFunction(prev => ({ ...prev, httpMethod: e.target.value as FunctionDeclaration['httpMethod'] }))} // Specific cast
                                                className="w-full p-3 bg-[var(--color-function-method-dropdown-bg)] border border-[var(--color-function-method-dropdown-border)] rounded-lg text-[var(--color-function-method-dropdown-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-text-input-focus-border)] transition-colors hover:bg-[var(--color-function-method-dropdown-hover-bg)]"
                                            >
                                                <option value="GET">GET</option>
                                                <option value="POST">POST</option>
                                                <option value="PUT">PUT</option>
                                                <option value="PATCH">PATCH</option>
                                                <option value="DELETE">DELETE</option>
                                            </select>
                                        </div>
                                        <TextInput
                                            id={`endpoint-${func.id}`}
                                            name="endpointUrl"
                                            label="URL do Endpoint"
                                            tooltipContent="O URL completo para onde a requisição da função será enviada."
                                            value={newFunction.endpointUrl}
                                            onChange={(val) => setNewFunction(prev => ({ ...prev, endpointUrl: val }))}
                                            placeholder="Ex: https://api.example.com/weather"
                                            type="url"
                                            containerClassName="flex-1"
                                            inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center mb-1.5">
                                            <Tooltip content="Um JSON Schema que descreve os parâmetros que a função aceita. Isso é crucial para a IA saber como chamar a função corretamente.">
                                                <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                                            </Tooltip>
                                            <label htmlFor={`schema-${func.id}`} className="block text-sm font-medium text-[var(--color-text-input-label-text)]">Schema de Parâmetros (JSON)</label>
                                        </div>
                                        <textarea
                                            id={`schema-${func.id}`}
                                            name="parametersSchema"
                                            value={newFunction.parametersSchema}
                                            onChange={(e) => setNewFunction(prev => ({ ...prev, parametersSchema: e.target.value }))}
                                            rows={6}
                                            className="w-full p-3 bg-[var(--color-function-param-schema-bg)] border border-[var(--color-function-param-schema-border)] rounded-lg text-[var(--color-function-param-schema-text)] placeholder-[var(--color-function-param-schema-placeholder)] shadow-sm focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-function-param-schema-focus-border)] transition-colors font-mono text-xs"
                                            placeholder={`{\n  "type": "object",\n  "properties": {\n    "city": {\n      "type": "string",\n      "description": "Nome da cidade"\n    }\n  },\n  "required": ["city"]\n}`}
                                        ></textarea>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                                            <IoCloseOutline className="mr-1" /> Cancelar
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={handleSaveFunction}>
                                            <IoCheckmarkOutline className="mr-1" /> Salvar
                                        </Button>
                                    </div>
                                </div>
                            }
                            actions={
                                <>
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleEditFunction(func)} className="text-[var(--color-table-item-icon)] hover:text-[var(--color-table-item-icon-hover)]">
                                        <IoPencilOutline size={19} />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteFunction(func.id)} className="text-[var(--color-table-item-icon)] hover:text-[var(--color-red-500)]">
                                        <IoTrashOutline size={19} />
                                    </Button>
                                </>
                            }
                        >
                            <div className="p-4">
                                <p className="text-lg font-semibold text-[var(--color-function-card-name-text)] mb-1 truncate">{func.name}</p>
                                <p className="text-sm text-[var(--color-function-card-description-text)] mb-2 truncate">{func.description}</p>
                                <div className="flex items-center text-xs mt-2">
                                    <span className="font-mono uppercase px-2 py-0.5 rounded-md bg-[var(--color-function-card-http-method-bg)] text-[var(--color-function-card-http-method-text)] border border-[var(--color-function-card-http-method-border)] mr-2">
                                        {func.httpMethod}
                                    </span>
                                    <span className="font-mono text-[var(--color-function-card-endpoint-text)] truncate" title={func.endpointUrl}>
                                        {func.endpointUrl}
                                    </span>
                                </div>
                            </div>
                        </SettingsCard>
                    ))}

                    {editingFunctionId === 'new' && (
                        <SettingsCard
                            isEditing={true} // Always editing when adding new
                            editForm={
                                <div className="flex flex-col space-y-3 p-4">
                                    <TextInput
                                        id="new-name"
                                        name="name"
                                        label="Nome da Função"
                                        tooltipContent="O nome único da função que a IA usará para chamá-la. Deve ser descritivo e em camelCase."
                                        value={newFunction.name}
                                        onChange={(val) => setNewFunction(prev => ({ ...prev, name: val }))}
                                        placeholder="Ex: getWeather"
                                        inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                    />
                                    <TextInput
                                        id="new-description"
                                        name="description"
                                        label="Descrição"
                                        tooltipContent="Uma breve descrição do que a função faz. Isso ajuda a IA a decidir quando usar a função."
                                        value={newFunction.description}
                                        onChange={(val) => setNewFunction(prev => ({ ...prev, description: val }))}
                                        placeholder="Ex: Obtém a previsão do tempo para uma cidade"
                                        inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                    />
                                    <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                                        <div className="flex-1">
                                            <div className="flex items-center mb-1.5">
                                                <Tooltip content="O método HTTP a ser usado para a requisição ao endpoint da função.">
                                                    <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                                                </Tooltip>
                                                <label htmlFor="new-method" className="block text-sm font-medium text-[var(--color-text-input-label-text)]">Método HTTP</label>
                                            </div>
                                            <select
                                                id="new-method"
                                                name="httpMethod"
                                                value={newFunction.httpMethod}
                                                onChange={(e) => setNewFunction(prev => ({ ...prev, httpMethod: e.target.value as FunctionDeclaration['httpMethod'] }))} // Specific cast
                                                className="w-full p-3 bg-[var(--color-function-method-dropdown-bg)] border border-[var(--color-function-method-dropdown-border)] rounded-lg text-[var(--color-function-method-dropdown-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-text-input-focus-border)] transition-colors hover:bg-[var(--color-function-method-dropdown-hover-bg)]"
                                            >
                                                <option value="GET">GET</option>
                                                <option value="POST">POST</option>
                                                <option value="PUT">PUT</option>
                                                <option value="PATCH">PATCH</option>
                                                <option value="DELETE">DELETE</option>
                                            </select>
                                        </div>
                                        <TextInput
                                            id="new-endpoint"
                                            name="endpointUrl"
                                            label="URL do Endpoint"
                                            tooltipContent="O URL completo para onde a requisição da função será enviada."
                                            value={newFunction.endpointUrl}
                                            onChange={(val) => setNewFunction(prev => ({ ...prev, endpointUrl: val }))}
                                            placeholder="Ex: https://api.example.com/weather"
                                            type="url"
                                            containerClassName="flex-1"
                                            inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center mb-1.5">
                                            <Tooltip content="Um JSON Schema que descreve os parâmetros que a função aceita. Isso é crucial para a IA saber como chamar a função corretamente.">
                                                <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                                            </Tooltip>
                                            <label htmlFor="new-schema" className="block text-sm font-medium text-[var(--color-text-input-label-text)]">Schema de Parâmetros (JSON)</label>
                                        </div>
                                        <textarea
                                            id="new-schema"
                                            name="parametersSchema"
                                            value={newFunction.parametersSchema}
                                            onChange={(e) => setNewFunction(prev => ({ ...prev, parametersSchema: e.target.value }))}
                                            rows={6}
                                            className="w-full p-3 bg-[var(--color-function-param-schema-bg)] border border-[var(--color-function-param-schema-border)] rounded-lg text-[var(--color-function-param-schema-text)] placeholder-[var(--color-function-param-schema-placeholder)] shadow-sm focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-function-param-schema-focus-border)] transition-colors font-mono text-xs"
                                            placeholder={`{\n  "type": "object",\n  "properties": {\n    "city": {\n      "type": "string",\n      "description": "Nome da cidade"\n    }\n  },\n  "required": ["city"]\n}`}
                                        ></textarea>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                                            <IoCloseOutline className="mr-1" /> Cancelar
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={handleSaveFunction}>
                                            <IoCheckmarkOutline className="mr-1" /> Salvar
                                        </Button>
                                    </div>
                                </div>
                            }
                        >
                            {/* No display content when adding new, but children prop is required */}
                            <></>
                        </SettingsCard>
                    )}
                </div>
            </SettingsPanel>
        </div>
    );
};

export default FunctionCallingSettingsTab;
