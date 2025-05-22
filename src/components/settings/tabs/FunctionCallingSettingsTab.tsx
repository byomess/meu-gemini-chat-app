// src/components/settings/tabs/FunctionCallingSettingsTab.tsx
import React, { useState, useRef } from "react";
import { IoAddCircleOutline, IoPencilOutline, IoTrashBinOutline, IoTerminalOutline, IoLinkOutline, IoArrowUpOutline, IoArrowDownOutline } from "react-icons/io5"; // Added new icons
import Button from "../../common/Button";
import { v4 as uuidv4 } from "uuid";
import type { FunctionDeclaration as AppFunctionDeclaration } from "../../../types";

interface LocalFunctionDeclaration {
    id: string;
    name: string;
    description: string;
    parametersSchema: string;
    endpointUrl: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

const DEFAULT_FUNCTION_PARAMS_SCHEMA_PLACEHOLDER = `{
  "type": "object",
  "properties": {
    "paramName": {
      "type": "string",
      "description": "Description of the parameter."
    }
  },
  "required": ["paramName"]
}`;

interface FunctionCallingSettingsTabProps {
    currentFunctionDeclarations: LocalFunctionDeclaration[];
    setCurrentFunctionDeclarations: (
        declarations: LocalFunctionDeclaration[]
    ) => void;
}

const FunctionCallingSettingsTab: React.FC<FunctionCallingSettingsTabProps> = ({
    currentFunctionDeclarations,
    setCurrentFunctionDeclarations,
}) => {
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editParamsSchema, setEditParamsSchema] = useState("");
    const [editEndpointUrl, setEditEndpointUrl] = useState("");
    const [editHttpMethod, setEditHttpMethod] =
        useState<LocalFunctionDeclaration["httpMethod"]>("GET");
    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

    const isValidUrl = (urlString: string): boolean => {
        try {
            new URL(urlString);
            return true;
        } catch {
            return false;
        }
    };

    const resetForm = () => {
        setIsEditing(null);
        setEditName("");
        setEditDescription("");
        setEditParamsSchema("");
        setEditEndpointUrl("");
        setEditHttpMethod("GET");
    };

    const handleStartAddNew = () => {
        resetForm();
        setIsEditing("new");
        setEditParamsSchema(DEFAULT_FUNCTION_PARAMS_SCHEMA_PLACEHOLDER);
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const handleStartEdit = (declaration: LocalFunctionDeclaration) => {
        setIsEditing(declaration.id);
        setEditName(declaration.name);
        setEditDescription(declaration.description);
        setEditParamsSchema(declaration.parametersSchema);
        setEditEndpointUrl(declaration.endpointUrl);
        setEditHttpMethod(declaration.httpMethod);
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const handleDelete = (id: string) => {
        if (
            window.confirm(
                `Tem certeza que deseja excluir a função "${currentFunctionDeclarations.find((d) => d.id === id)?.name ||
                "esta função"
                }"?`
            )
        ) {
            setCurrentFunctionDeclarations(
                currentFunctionDeclarations.filter((d) => d.id !== id)
            );
            if (isEditing === id) {
                resetForm();
            }
        }
    };

    const handleSave = () => {
        if (!editName.trim()) {
            alert("O nome da função é obrigatório.");
            return;
        }
        if (!editDescription.trim()) {
            alert("A descrição da função é obrigatória.");
            return;
        }
        if (!editEndpointUrl.trim()) {
            alert("A URL do Endpoint da API é obrigatória.");
            return;
        }
        if (!isValidUrl(editEndpointUrl.trim())) {
            alert("A URL do Endpoint da API fornecida não é válida.");
            return;
        }
        try {
            if (editParamsSchema.trim()) {
                JSON.parse(editParamsSchema);
            }
        } catch {
            alert(
                "O esquema de parâmetros não é um JSON válido. Verifique a sintaxe."
            );
            return;
        }
        const declarationData: Omit<LocalFunctionDeclaration, "id"> = {
            name: editName.trim(),
            description: editDescription.trim(),
            parametersSchema: editParamsSchema.trim(),
            endpointUrl: editEndpointUrl.trim(),
            httpMethod: editHttpMethod,
        };
        if (isEditing === "new") {
            setCurrentFunctionDeclarations([
                ...currentFunctionDeclarations,
                { id: uuidv4(), ...declarationData },
            ]);
        } else if (isEditing) {
            setCurrentFunctionDeclarations(
                currentFunctionDeclarations.map((d) =>
                    d.id === isEditing ? { ...d, ...declarationData } : d
                )
            );
        }
        resetForm();
    };

    const handleExport = () => {
        const filename = "function_callings.json";
        const jsonStr = JSON.stringify(currentFunctionDeclarations, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedData: LocalFunctionDeclaration[] = JSON.parse(content);

                if (!Array.isArray(importedData)) {
                    alert("O arquivo importado não contém uma lista válida de funções.");
                    return;
                }

                const validatedData: LocalFunctionDeclaration[] = [];
                for (const item of importedData) {
                    // Basic validation for required fields
                    if (
                        item &&
                        typeof item.name === 'string' &&
                        typeof item.description === 'string' &&
                        typeof item.parametersSchema === 'string' &&
                        typeof item.endpointUrl === 'string' &&
                        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(item.httpMethod)
                    ) {
                        validatedData.push({ ...item, id: uuidv4() }); // Assign new UUIDs to avoid conflicts
                    } else {
                        console.warn("Skipping invalid function declaration during import:", item);
                    }
                }

                if (validatedData.length > 0) {
                    setCurrentFunctionDeclarations(validatedData);
                    alert(`Importadas ${validatedData.length} funções com sucesso.`);
                } else {
                    alert("Nenhuma função válida encontrada no arquivo importado.");
                }

            } catch (error) {
                console.error("Erro ao importar funções:", error);
                alert("Erro ao processar o arquivo. Certifique-se de que é um JSON válido.");
            } finally {
                // Clear the file input value to allow importing the same file again
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.onerror = () => {
            alert("Erro ao ler o arquivo.");
        };
        reader.readAsText(file);
    };

    const formTitle =
        isEditing === "new"
            ? "Adicionar Nova Função (API Endpoint)"
            : isEditing
                ? "Editar Função (API Endpoint)"
                : "";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-800">
                    Funções Externas (API Endpoints) ({currentFunctionDeclarations.length}
                    )
                </h3>
                <div className="flex gap-2"> {/* Grouping buttons */}
                    <Button
                        variant="secondary"
                        onClick={handleExport}
                        className="!text-xs !py-1.5 !px-2.5 !font-medium" // Changed !py-2 to !py-1.5 and !px-3.5 to !px-2.5
                        disabled={isEditing || currentFunctionDeclarations.length === 0}
                        title="Exportar funções para JSON"
                    >
                        <IoArrowDownOutline className="mr-1.5" size={18} /> Exportar
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImport}
                        accept=".json"
                        className="hidden"
                    />
                    <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="!text-xs !py-1.5 !px-2.5 !font-medium" // Changed !py-2 to !py-1.5 and !px-3.5 to !px-2.5
                        disabled={isEditing}
                        title="Importar funções de um arquivo JSON"
                    >
                        <IoArrowUpOutline className="mr-1.5" size={18} /> Importar
                    </Button>
                    {!isEditing && (
                        <Button
                            variant="primary"
                            onClick={handleStartAddNew}
                            className="!text-xs !py-1.5 !px-2.5" // Changed !text-sm to !text-xs, !py-2 to !py-1.5 and !px-3.5 to !px-2.5
                        >
                            <IoAddCircleOutline className="mr-1.5" size={18} /> Adicionar Nova
                        </Button>
                    )}
                </div>
            </div>
            <p className="text-xs text-gray-500 -mt-4">
                Declare APIs externas que a IA pode chamar. O Loox atuará como um proxy
                para essas chamadas.
            </p>
            {isEditing && (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md space-y-4">
                    <h4 className="text-sm font-semibold text-[#e04579]">{formTitle}</h4>
                    <div>
                        <label
                            htmlFor="funcName"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            Nome da Função (para a IA)
                        </label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            id="funcName"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="ex: getCurrentWeather, searchProducts"
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Nome que a IA usará para chamar esta API. Use camelCase ou
                            snake_case.
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcDesc"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            Descrição (para a IA)
                        </label>
                        <textarea
                            id="funcDesc"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            placeholder="ex: Obtém o clima atual para uma localidade..."
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 resize-y"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Descreva o que a API faz...
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcEndpointUrl"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            URL do Endpoint da API
                        </label>
                        <input
                            type="url"
                            id="funcEndpointUrl"
                            value={editEndpointUrl}
                            onChange={(e) => setEditEndpointUrl(e.target.value)}
                            placeholder="ex: https://api.example.com/weather"
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="funcHttpMethod"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            Método HTTP
                        </label>
                        <select
                            id="funcHttpMethod"
                            value={editHttpMethod}
                            onChange={(e) =>
                                setEditHttpMethod(
                                    e.target.value as LocalFunctionDeclaration["httpMethod"]
                                )
                            }
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] text-sm text-gray-800 appearance-none bg-no-repeat bg-right pr-8"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundSize: "1.5em 1.5em",
                                backgroundPosition: "right 0.5rem center",
                            }}
                        >
                            <option value="GET" className="bg-white">GET</option>
                            <option value="POST" className="bg-white">POST</option>
                            <option value="PUT" className="bg-white">PUT</option>
                            <option value="PATCH" className="bg-white">PATCH</option>
                            <option value="DELETE" className="bg-white">DELETE</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Para GET, os parâmetros da função serão adicionados como query
                            strings...
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="funcParams"
                            className="block text-xs font-medium text-gray-600 mb-1"
                        >
                            Esquema de Parâmetros (JSON - para a IA)
                        </label>
                        <textarea
                            id="funcParams"
                            value={editParamsSchema}
                            onChange={(e) => setEditParamsSchema(e.target.value)}
                            rows={6}
                            placeholder={DEFAULT_FUNCTION_PARAMS_SCHEMA_PLACEHOLDER}
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-sm text-gray-800 font-mono resize-y"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Define os parâmetros que a IA pode enviar para esta API...
                        </p>
                    </div>
                    <div className="flex justify-end gap-2.5">
                        <Button
                            variant="secondary"
                            onClick={resetForm}
                            className="!text-xs !py-1.5 !px-3"
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            className="!text-xs !py-1.5 !px-3"
                        >
                            Salvar Função
                        </Button>
                    </div>
                </div>
            )}
            {currentFunctionDeclarations.length > 0 ? (
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-[calc(100vh-480px)] sm:max-h-[calc(100vh-450px)] min-h-[100px]">
                    {currentFunctionDeclarations.map((declaration) => (
                        <div
                            key={declaration.id}
                            className={`p-2.5 bg-white rounded-md shadow border ${isEditing === declaration.id
                                ? "ring-2 ring-[#e04579] border-transparent"
                                : "border-gray-200 hover:shadow-md"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-grow min-w-0"> {/* Added min-w-0 here */}
                                    <p className="text-sm font-semibold text-[#e04579] break-words">
                                        {declaration.name}
                                    </p>
                                    <p
                                        className="text-xs text-gray-700 mt-0.5 break-words whitespace-pre-wrap"
                                        title={declaration.description}
                                    >
                                        {declaration.description.substring(0, 100)}
                                        {declaration.description.length > 100 ? "..." : ""}
                                    </p>
                                    <div className="mt-1.5 flex items-center text-xs text-gray-500">
                                        <IoLinkOutline size={14} className="mr-1 flex-shrink-0" />
                                        <span className="truncate" title={declaration.endpointUrl}>
                                            {declaration.endpointUrl}
                                        </span>
                                        <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] font-medium">
                                            {declaration.httpMethod}
                                        </span>
                                    </div>
                                </div>
                                {!isEditing && (
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                        <Button
                                            variant="icon"
                                            className="!p-1.5 text-gray-500 hover:!text-[#e04579] hover:!bg-pink-100"
                                            title="Editar função"
                                            onClick={() => handleStartEdit(declaration)}
                                        >
                                            {" "}
                                            <IoPencilOutline size={15} />{" "}
                                        </Button>
                                        <Button
                                            variant="icon"
                                            className="!p-1.5 text-gray-500 hover:!text-red-500 hover:!bg-red-100"
                                            title="Excluir função"
                                            onClick={() => handleDelete(declaration.id)}
                                        >
                                            {" "}
                                            <IoTrashBinOutline size={15} />{" "}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                !isEditing && (
                    <div className="p-4 text-center bg-gray-50 rounded-lg border border-gray-200">
                        <IoTerminalOutline
                            size={28}
                            className="mx-auto text-gray-400 mb-2"
                        />
                        <p className="text-sm text-gray-500">
                            Nenhuma API externa configurada.
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Adicione APIs para que a IA possa interagir com serviços externos.
                        </p>
                    </div>
                )
            )}
        </div>
    );
};

export default FunctionCallingSettingsTab;
