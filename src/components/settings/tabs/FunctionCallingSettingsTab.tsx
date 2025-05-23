// src/components/settings/tabs/FunctionCallingSettingsTab.tsx
import React, { useState, useCallback } from 'react';
import Button from '../../common/Button';
import TextInput from '../../common/TextInput';
import { IoAddCircleOutline, IoTrashOutline, IoPencilOutline, IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import { FunctionDeclaration } from '../../../types';
import { useDialog } from '../../../contexts/DialogContext';

interface FunctionCallingSettingsTabProps {
    currentFunctionDeclarations: FunctionDeclaration[];
    setCurrentFunctionDeclarations: (declarations: FunctionDeclaration[]) => void;
}

interface LocalFunctionDeclaration {
    id: string;
    name: string;
    description: string;
    parametersSchema: string;
    endpointUrl: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

const FunctionCallingSettingsTab: React.FC<FunctionCallingSettingsTabProps> = ({
    currentFunctionDeclarations,
    setCurrentFunctionDeclarations,
}) => {
    const { showDialog } = useDialog();
    const [editingFunctionId, setEditingFunctionId] = useState<string | null>(null);
    const [newFunction, setNewFunction] = useState<LocalFunctionDeclaration>({
        id: '',
        name: '',
        description: '',
        parametersSchema: '',
        endpointUrl: '',
        httpMethod: 'POST',
    });

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
        } catch (e) {
            showDialog({
                title: "Schema Inválido",
                message: "O 'Schema de Parâmetros' deve ser um JSON válido.",
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

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)]">Chamada de Função</h2>
            <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4 border-b border-[var(--color-settings-section-border)]">
                Defina funções personalizadas que a IA pode chamar para interagir com serviços externos.
                Certifique-se de que o 'Schema de Parâmetros' seja um JSON Schema válido.
            </p>

            <div className="space-y-4">
                {currentFunctionDeclarations.map((func) => (
                    <div key={func.id} className="bg-[var(--color-table-row-bg)] p-4 rounded-lg shadow-sm border border-[var(--color-table-row-border)] hover:bg-[var(--color-table-row-hover-bg)] transition-colors">
                        {editingFunctionId === func.id ? (
                            <div className="flex flex-col space-y-3">
                                <TextInput
                                    id={`name-${func.id}`}
                                    name="name"
                                    label="Nome da Função"
                                    value={newFunction.name}
                                    onChange={(val) => setNewFunction(prev => ({ ...prev, name: val }))}
                                    placeholder="Ex: getWeather"
                                    inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                />
                                <TextInput
                                    id={`description-${func.id}`}
                                    name="description"
                                    label="Descrição"
                                    value={newFunction.description}
                                    onChange={(val) => setNewFunction(prev => ({ ...prev, description: val }))}
                                    placeholder="Ex: Obtém a previsão do tempo para uma cidade"
                                    inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                />
                                <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                                    <div className="flex-1">
                                        <label htmlFor={`method-${func.id}`} className="block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1.5">Método HTTP</label>
                                        <select
                                            id={`method-${func.id}`}
                                            name="httpMethod"
                                            value={newFunction.httpMethod}
                                            onChange={(e) => setNewFunction(prev => ({ ...prev, httpMethod: e.target.value as any }))}
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
                                        value={newFunction.endpointUrl}
                                        onChange={(val) => setNewFunction(prev => ({ ...prev, endpointUrl: val }))}
                                        placeholder="Ex: https://api.example.com/weather"
                                        type="url"
                                        containerClassName="flex-1"
                                        inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor={`schema-${func.id}`} className="block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1.5">Schema de Parâmetros (JSON)</label>
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
                        ) : (
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-base font-medium text-[var(--color-table-item-text)]">{func.name}</p>
                                    <p className="text-sm text-[var(--color-table-item-secondary-text)]">{func.description}</p>
                                    <p className="text-xs text-[var(--color-table-item-secondary-text)] mt-1">
                                        <span className="font-mono uppercase text-[var(--color-table-item-text)]">{func.httpMethod}</span>: {func.endpointUrl}
                                    </p>
                                </div>
                                <div className="flex space-x-1 ml-4 flex-shrink-0">
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleEditFunction(func)} className="text-[var(--color-table-item-icon)] hover:text-[var(--color-table-item-icon-hover)]">
                                        <IoPencilOutline size={18} />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteFunction(func.id)} className="text-[var(--color-table-item-icon)] hover:text-[var(--color-red-500)]">
                                        <IoTrashOutline size={18} />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {editingFunctionId === 'new' && (
                    <div className="bg-[var(--color-table-row-bg)] p-4 rounded-lg shadow-sm border border-[var(--color-table-row-border)]">
                        <div className="flex flex-col space-y-3">
                            <TextInput
                                id="new-name"
                                name="name"
                                label="Nome da Função"
                                value={newFunction.name}
                                onChange={(val) => setNewFunction(prev => ({ ...prev, name: val }))}
                                placeholder="Ex: getWeather"
                                inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                            />
                            <TextInput
                                id="new-description"
                                name="description"
                                label="Descrição"
                                value={newFunction.description}
                                onChange={(val) => setNewFunction(prev => ({ ...prev, description: val }))}
                                placeholder="Ex: Obtém a previsão do tempo para uma cidade"
                                inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                            />
                            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                                <div className="flex-1">
                                    <label htmlFor="new-method" className="block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1.5">Método HTTP</label>
                                    <select
                                        id="new-method"
                                        name="httpMethod"
                                        value={newFunction.httpMethod}
                                        onChange={(e) => setNewFunction(prev => ({ ...prev, httpMethod: e.target.value as any }))}
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
                                    value={newFunction.endpointUrl}
                                    onChange={(val) => setNewFunction(prev => ({ ...prev, endpointUrl: val }))}
                                    placeholder="Ex: https://api.example.com/weather"
                                    type="url"
                                    containerClassName="flex-1"
                                    inputClassName="bg-[var(--color-table-item-edit-bg)] border-[var(--color-table-item-edit-border)] text-[var(--color-table-item-edit-text)] placeholder-[var(--color-table-item-edit-placeholder)]"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="new-schema" className="block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1.5">Schema de Parâmetros (JSON)</label>
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
                                    <IoCheckmarkOutline className="mr-1" /> Adicionar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!editingFunctionId && (
                    <Button variant="secondary" onClick={handleAddFunction} className="w-full">
                        <IoAddCircleOutline className="mr-2" size={20} /> Adicionar Nova Função
                    </Button>
                )}
            </div>
        </div>
    );
};

export default FunctionCallingSettingsTab;
