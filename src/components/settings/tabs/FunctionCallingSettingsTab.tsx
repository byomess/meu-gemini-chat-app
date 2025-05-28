// src/components/settings/tabs/FunctionCallingSettingsTab.tsx
import React, { useState, useCallback, useRef } from 'react';
import Button from '../../common/Button';
import TextInput from '../../common/TextInput';
import { IoAddCircleOutline, IoTrashOutline, IoPencilOutline, IoCheckmarkOutline, IoCloseOutline, IoArrowUpCircleOutline, IoArrowDownCircleOutline, IoInformationCircleOutline, IoLockClosedOutline, IoCodeSlashOutline, IoCloudOutline } from 'react-icons/io5';
import {type  FunctionDeclaration } from '../../../types'; // Import FunctionDeclaration
import { useDialog } from '../../../contexts/DialogContext';
import SettingsCard from '../../common/SettingsCard'; // Import the new SettingsCard
import SettingsPanel from '../SettingsPanel'; // Import the new SettingsPanel
import Tooltip from '../../common/Tooltip'; // Import Tooltip for select elements

export interface FunctionCallingSettingsTabProps {
    currentFunctionDeclarations: FunctionDeclaration[];
    setCurrentFunctionDeclarations: (declarations: FunctionDeclaration[]) => void;
}

const initialNewFunctionState: FunctionDeclaration = {
    id: '',
    name: '',
    description: '',
    parametersSchema: '',
    type: 'api', // Default to API for new functions
    endpointUrl: '',
    httpMethod: 'POST',
    code: undefined,
    isNative: false,
};


const FunctionCallingSettingsTab: React.FC<FunctionCallingSettingsTabProps> = ({
    currentFunctionDeclarations,
    setCurrentFunctionDeclarations,
}) => {
    const { showDialog } = useDialog();
    const [editingFunctionId, setEditingFunctionId] = useState<string | null>(null);
    const [newFunction, setNewFunction] = useState<FunctionDeclaration>(initialNewFunctionState);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddFunction = useCallback(() => {
        setEditingFunctionId('new');
        setNewFunction({
            ...initialNewFunctionState,
            id: crypto.randomUUID(),
        });
    }, []);

    const handleSaveFunction = useCallback(() => {
        if (!newFunction.name || !newFunction.description || !newFunction.parametersSchema) {
            showDialog({
                title: "Campos Obrigatórios",
                message: "Por favor, preencha Nome, Descrição e Schema de Parâmetros.",
                type: "alert",
            });
            return;
        }

        if (newFunction.type === 'api' && !newFunction.endpointUrl) {
            showDialog({
                title: "Campos Obrigatórios para API",
                message: "Para funções do tipo API, a URL do Endpoint é obrigatória.",
                type: "alert",
            });
            return;
        }
        
        if (newFunction.type === 'javascript' && !newFunction.code) {
            // This case should not be reachable if users cannot create/edit JS function code
            showDialog({
                title: "Campos Obrigatórios para JavaScript",
                message: "Para funções do tipo JavaScript, o código é obrigatório.",
                type: "alert",
            });
            return;
        }

        try {
            JSON.parse(newFunction.parametersSchema);
        } catch (e: unknown) {
            showDialog({
                title: "Schema Inválido",
                message: `O 'Schema de Parâmetros' deve ser um JSON válido. Detalhes: ${e instanceof Error ? e.message : String(e)}`,
                type: "alert",
            });
            return;
        }

        if (editingFunctionId === 'new') {
            // Ensure new functions are correctly typed as 'api' and don't have 'code'
            const functionToAdd: FunctionDeclaration = {
                ...newFunction,
                type: 'api',
                code: undefined,
                isNative: false, // Explicitly set for safety
            };
            setCurrentFunctionDeclarations([...currentFunctionDeclarations, functionToAdd]);
        } else if (editingFunctionId) {
            setCurrentFunctionDeclarations(currentFunctionDeclarations.map(f =>
                f.id === editingFunctionId ? { ...newFunction, isNative: f.isNative } : f // Preserve isNative status
            ));
        }
        setEditingFunctionId(null);
        setNewFunction(initialNewFunctionState);
    }, [newFunction, editingFunctionId, currentFunctionDeclarations, setCurrentFunctionDeclarations, showDialog]);

    const handleEditFunction = useCallback((func: FunctionDeclaration) => {
        if (func.isNative) { // Should not happen if edit button is hidden, but as a safeguard
            showDialog({
                title: "Função Nativa",
                message: "Funções nativas não podem ser editadas diretamente.",
                type: "alert",
            });
            return;
        }
        setEditingFunctionId(func.id);
        setNewFunction({ ...func });
    }, [showDialog]);

    const handleCancelEdit = useCallback(() => {
        setEditingFunctionId(null);
        setNewFunction(initialNewFunctionState);
    }, []);

    const handleDeleteFunction = useCallback((id: string) => {
        const funcToDelete = currentFunctionDeclarations.find(f => f.id === id);
        if (funcToDelete?.isNative) { // Should not happen if delete button is hidden
            showDialog({
                title: "Função Nativa",
                message: "Funções nativas não podem ser excluídas.",
                type: "alert",
            });
            return;
        }
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
        // currentFunctionDeclarations already includes native functions from AppSettingsContext
        const dataStr = JSON.stringify(currentFunctionDeclarations, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'loox_function_declarations.json';
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
                const importedData: Partial<FunctionDeclaration>[] = JSON.parse(content);

                if (!Array.isArray(importedData) || !importedData.every(item =>
                    typeof item === 'object' && item !== null &&
                    'id' in item && typeof item.id === 'string' &&
                    'name' in item && typeof item.name === 'string' &&
                    'description' in item && typeof item.description === 'string' &&
                    'parametersSchema' in item && typeof item.parametersSchema === 'string'
                    // Type, endpointUrl, httpMethod, code are optional in the file
                )) {
                    showDialog({
                        title: "Erro de Importação",
                        message: "O arquivo JSON não contém uma lista válida de declarações de função. Verifique a estrutura mínima (id, name, description, parametersSchema).",
                        type: "alert",
                    });
                    return;
                }

                const existingIds = new Set(currentFunctionDeclarations.map(f => f.id));
                const nativeIds = new Set(currentFunctionDeclarations.filter(f => f.isNative).map(f => f.id));

                const functionsToImport: FunctionDeclaration[] = importedData
                    .filter(func => !nativeIds.has(func.id!)) // Do not import if ID matches a native function
                    .map(func => {
                        const baseFunction = {
                            ...initialNewFunctionState, // Start with defaults
                            id: existingIds.has(func.id!) ? crypto.randomUUID() : func.id!,
                            name: func.name!,
                            description: func.description!,
                            parametersSchema: func.parametersSchema!,
                            isNative: false, // Imported functions are never native
                        };

                        if (func.type === 'javascript') {
                            return {
                                ...baseFunction,
                                type: 'javascript',
                                code: func.code || '// Código JavaScript aqui',
                                endpointUrl: undefined,
                                httpMethod: undefined,
                            };
                        } else { // Default to 'api' or if type is 'api'
                            return {
                                ...baseFunction,
                                type: 'api',
                                endpointUrl: func.endpointUrl || '',
                                httpMethod: func.httpMethod || 'POST',
                                code: undefined,
                            };
                        }
                    });

                setCurrentFunctionDeclarations([...currentFunctionDeclarations.filter(f => !functionsToImport.some(imported => imported.id === f.id)), ...functionsToImport]);
                showDialog({
                    title: "Importação Concluída",
                    message: `Foram importadas ${functionsToImport.length} declarações de função. Funções com IDs de funções nativas existentes foram ignoradas.`,
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [currentFunctionDeclarations, setCurrentFunctionDeclarations, showDialog]);


    const renderEditForm = (funcToEdit: FunctionDeclaration) => {
        const isNativeEditing = funcToEdit.isNative || false; // If editing an existing native func (view only)
        const currentType = funcToEdit.type;

        return (
            <div className="flex flex-col space-y-3 p-4">
                <TextInput
                    id={`name-${funcToEdit.id}`}
                    name="name"
                    label="Nome da Função"
                    tooltipContent="O nome único da função que a IA usará para chamá-la. Deve ser descritivo e em camelCase."
                    value={funcToEdit.name}
                    onChange={(val) => setNewFunction(prev => ({ ...prev, name: val }))}
                    placeholder="Ex: getWeather"
                    inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                    disabled={isNativeEditing}
                />
                <TextInput
                    id={`description-${funcToEdit.id}`}
                    name="description"
                    label="Descrição"
                    tooltipContent="Uma breve descrição do que a função faz. Isso ajuda a IA a decidir quando usar a função."
                    value={funcToEdit.description}
                    onChange={(val) => setNewFunction(prev => ({ ...prev, description: val }))}
                    placeholder="Ex: Obtém a previsão do tempo para uma cidade"
                    inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                    disabled={isNativeEditing}
                />

                {currentType === 'api' && (
                    <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                        <div className="flex-1">
                            <div className="flex items-center mb-1.5">
                                <Tooltip content="O método HTTP a ser usado para a requisição ao endpoint da função.">
                                    <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                                </Tooltip>
                                <label htmlFor={`method-${funcToEdit.id}`} className="block text-sm font-medium text-[var(--color-text-input-label-text)]">Método HTTP</label>
                            </div>
                            <select
                                id={`method-${funcToEdit.id}`}
                                name="httpMethod"
                                value={funcToEdit.httpMethod || 'POST'}
                                onChange={(e) => setNewFunction(prev => ({ ...prev, httpMethod: e.target.value as FunctionDeclaration['httpMethod'] }))}
                                className="w-full p-3 bg-[var(--color-function-method-dropdown-bg)] border border-[var(--color-function-method-dropdown-border)] rounded-lg text-[var(--color-function-method-dropdown-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-text-input-focus-border)] transition-colors hover:bg-[var(--color-function-method-dropdown-hover-bg)]"
                                disabled={isNativeEditing}
                            >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="PATCH">PATCH</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        <TextInput
                            id={`endpoint-${funcToEdit.id}`}
                            name="endpointUrl"
                            label="URL do Endpoint"
                            tooltipContent="O URL completo para onde a requisição da função será enviada."
                            value={funcToEdit.endpointUrl || ''}
                            onChange={(val) => setNewFunction(prev => ({ ...prev, endpointUrl: val }))}
                            placeholder="Ex: https://api.example.com/weather"
                            type="url"
                            className="flex-1"
                            inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                            disabled={isNativeEditing}
                        />
                    </div>
                )}

                {currentType === 'javascript' && (
                     <div className="flex flex-col">
                        <div className="flex items-center mb-1.5">
                            <Tooltip content="O código JavaScript a ser executado. Este campo é somente leitura para funções nativas.">
                                <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                            </Tooltip>
                            <label htmlFor={`code-${funcToEdit.id}`} className="block text-sm font-medium text-[var(--color-text-input-label-text)]">Código JavaScript (Somente Leitura)</label>
                        </div>
                        <textarea
                            id={`code-${funcToEdit.id}`}
                            name="code"
                            value={funcToEdit.code || ''}
                            rows={6}
                            className="w-full p-3 bg-[var(--color-function-param-schema-bg)] border border-[var(--color-function-param-schema-border)] rounded-lg text-[var(--color-function-param-schema-text)] placeholder-[var(--color-function-param-schema-placeholder)] shadow-sm focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-function-param-schema-focus-border)] transition-colors font-mono text-xs"
                            placeholder="// Código JavaScript aqui..."
                            disabled // Always disabled for now, especially for native
                        ></textarea>
                    </div>
                )}

                <div className="flex flex-col">
                    <div className="flex items-center mb-1.5">
                        <Tooltip content="Um JSON Schema que descreve os parâmetros que a função aceita. Isso é crucial para a IA saber como chamar a função corretamente.">
                            <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                        </Tooltip>
                        <label htmlFor={`schema-${funcToEdit.id}`} className="block text-sm font-medium text-[var(--color-text-input-label-text)]">Schema de Parâmetros (JSON)</label>
                    </div>
                    <textarea
                        id={`schema-${funcToEdit.id}`}
                        name="parametersSchema"
                        value={funcToEdit.parametersSchema}
                        onChange={(e) => setNewFunction(prev => ({ ...prev, parametersSchema: e.target.value }))}
                        rows={6}
                        className="w-full p-3 bg-[var(--color-function-param-schema-bg)] border border-[var(--color-function-param-schema-border)] rounded-lg text-[var(--color-function-param-schema-text)] placeholder-[var(--color-function-param-schema-placeholder)] shadow-sm focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-function-param-schema-focus-border)] transition-colors font-mono text-xs"
                        placeholder={`{\n  "type": "object",\n  "properties": {\n    "city": {\n      "type": "string",\n      "description": "Nome da cidade"\n    }\n  },\n  "required": ["city"]\n}`}
                        disabled={isNativeEditing}
                    ></textarea>
                </div>
                {!isNativeEditing && (
                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                            <IoCloseOutline className="mr-1" /> Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveFunction}>
                            <IoCheckmarkOutline className="mr-1" /> Salvar
                        </Button>
                    </div>
                )}
                 {isNativeEditing && (
                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                            <IoCloseOutline className="mr-1" /> Fechar
                        </Button>
                    </div>
                )}
            </div>
        );
    };


    return (
        <div className="space-y-6">
            <SettingsPanel
                title="Chamada de Função"
                description="Defina funções que a IA pode chamar. Funções nativas são pré-definidas e não podem ser alteradas. Você pode adicionar suas próprias funções de API."
            >
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4">
                    <Button
                        variant="primary"
                        onClick={handleAddFunction}
                        className="w-full sm:w-auto"
                        disabled={!!editingFunctionId}
                        size="sm"
                    >
                        <IoAddCircleOutline className="mr-2" size={20} /> Adicionar Função API
                    </Button>
                    <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
                        <Button variant="secondary" onClick={handleExportFunctions} className="w-full sm:w-auto" size="sm">
                            <IoArrowDownCircleOutline className="mr-2" size={20} /> Exportar
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportFunctions}
                            accept=".json"
                            className="hidden"
                        />
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto" size="sm">
                            <IoArrowUpCircleOutline className="mr-2" size={20} /> Importar
                        </Button>
                    </div>
                </div>

                <div className="space-y-4">
                    {currentFunctionDeclarations.map((func) => (
                        <SettingsCard
                            key={func.id}
                            isEditing={editingFunctionId === func.id}
                            isNative={func.isNative}
                            editForm={renderEditForm(newFunction)}
                            actions={
                                !func.isNative ? (
                                    <>
                                        <Button variant="ghost" size="icon-sm" onClick={() => handleEditFunction(func)} className="text-[var(--color-table-item-icon)] hover:text-[var(--color-table-item-icon-hover)]">
                                            <IoPencilOutline size={19} />
                                        </Button>
                                        <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteFunction(func.id)} className="text-[var(--color-table-item-icon)] hover:text-[var(--color-red-500)]">
                                            <IoTrashOutline size={19} />
                                        </Button>
                                    </>
                                ) : (
                                    // Optionally, show a view/info button for native functions if needed, or nothing
                                    <Tooltip content="Visualizar detalhes (somente leitura)">
                                        <Button variant="ghost" size="icon-sm" onClick={() => { setEditingFunctionId(func.id); setNewFunction(func);}} className="text-[var(--color-table-item-icon)] hover:text-[var(--color-table-item-icon-hover)]">
                                            <IoInformationCircleOutline size={19} />
                                        </Button>
                                    </Tooltip>
                                )
                            }
                        >
                            <div className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-lg font-semibold text-[var(--color-function-card-name-text)] mb-1 truncate pr-16">{func.name}</p>
                                        <p className="text-sm text-[var(--color-function-card-description-text)] mb-2 truncate">{func.description}</p>
                                    </div>
                                    {func.isNative && (
                                        <Tooltip content="Função Nativa">
                                            <span className="ml-2 mt-1 flex items-center px-2 py-1 text-xs font-medium bg-[var(--color-native-badge-bg)] text-[var(--color-native-badge-text)] border border-[var(--color-native-badge-border)] rounded-full">
                                                <IoLockClosedOutline className="mr-1.5" />
                                                Nativa
                                            </span>
                                        </Tooltip>
                                    )}
                                </div>

                                {func.type === 'api' && func.endpointUrl && (
                                    <div className="flex items-center text-xs mt-2">
                                        <span className="font-mono uppercase px-2 py-0.5 rounded-md bg-[var(--color-function-card-http-method-bg)] text-[var(--color-function-card-http-method-text)] border border-[var(--color-function-card-http-method-border)] mr-2">
                                            {func.httpMethod}
                                        </span>
                                        <span className="font-mono text-[var(--color-function-card-endpoint-text)] truncate" title={func.endpointUrl}>
                                            {func.endpointUrl}
                                        </span>
                                    </div>
                                )}
                                {func.type === 'javascript' && (
                                    <div className="flex items-center text-xs mt-2">
                                        <span className="font-mono uppercase px-2 py-0.5 rounded-md bg-[var(--color-function-card-js-badge-bg)] text-[var(--color-function-card-js-badge-text)] border border-[var(--color-function-card-js-badge-border)] mr-2 flex items-center">
                                            <IoCodeSlashOutline className="mr-1" /> JavaScript
                                        </span>
                                        {func.code && (
                                            <Tooltip content={func.code}>
                                                <span className="font-mono text-[var(--color-function-card-code-snippet-text)] truncate italic">
                                                    Hover para ver o código
                                                </span>
                                            </Tooltip>
                                        )}
                                    </div>
                                )}
                            </div>
                        </SettingsCard>
                    ))}

                    {editingFunctionId === 'new' && (
                        <SettingsCard
                            isEditing={true}
                            editForm={renderEditForm(newFunction)}
                        >
                            <></>
                        </SettingsCard>
                    )}
                </div>
            </SettingsPanel>
        </div>
    );
};

export default FunctionCallingSettingsTab;
