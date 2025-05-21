// src/components/chat/FileProcessingActivityIndicator.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { ProcessingStatus } from '../../types';
import {
    IoCloudUploadOutline,
    IoDocumentTextOutline,
    IoSyncOutline,
    IoCheckmarkCircleOutline,
    IoCloseCircleOutline,
    IoSettingsOutline,
    IoImageOutline,
    IoMusicalNotesOutline,
    IoVideocamOutline,
    IoEllipsisHorizontalCircleOutline
} from 'react-icons/io5';

interface FileProcessingActivityIndicatorProps {
    status: ProcessingStatus;
}

const MIN_DISPLAY_TIME = 1000; // 500ms, mesmo nome para consistência

// Função auxiliar para comparar os campos relevantes do status para o FileProcessing
// Estes são os campos que, ao mudarem, definem um "novo estado visual" que deve respeitar o timer.
const areFileProcessingStatusStatesEqual = (s1: ProcessingStatus, s2: ProcessingStatus): boolean => {
    if (!s1 || !s2) return s1 === s2;

    // Verifica se ambos são do tipo de processamento de arquivo relevante
    const isValidType = (status: ProcessingStatus) => 
        status.type === 'user_attachment_upload' || status.type === 'file_from_function_processing';

    if (!isValidType(s1) || !isValidType(s2)) {
        // Se um deles não for um tipo válido, considera-os diferentes se ambos não forem null/undefined
        // ou se um for válido e outro não. A lógica de renderização principal já filtra.
        return s1 === s2; 
    }

    // Compara os campos que definem a identidade visual do estado para o timer
    return s1.type === s2.type &&
           s1.stage === s2.stage &&
           s1.name === s2.name && // O nome do arquivo pode ser parte da identidade visual inicial
           (s1.error ? String(s1.error) : '') === (s2.error ? String(s2.error) : ''); // Comparar a mensagem de erro se houver
    // Nota: 'details' é omitido aqui de propósito para a *identidade do estado do timer*,
    // pois pode mudar frequentemente (ex: progresso percentual) sem necessariamente
    // alterar o estado visual principal (ícone, cor base). O 'details' ainda será usado na mensagem.
};


const FileProcessingActivityIndicator: React.FC<FileProcessingActivityIndicatorProps> = ({ status: propStatus }) => {
    const [displayedStatus, setDisplayedStatus] = useState<ProcessingStatus>(propStatus);
    const [isMounted, setIsMounted] = useState(false);
    const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastEffectiveDisplayChangeTimeRef = useRef<number>(0);

    useEffect(() => {
        setIsMounted(true);
        // Quando o componente monta, o propStatus é o primeiro a ser exibido.
        // Marcamos este tempo como o início da exibição deste estado.
        setDisplayedStatus(propStatus); // Garante que o estado inicial seja o da prop
        lastEffectiveDisplayChangeTimeRef.current = Date.now();
    }, []); // Apenas na montagem

    useEffect(() => {
        if (!isMounted) {
            return;
        }

        // Se o propStatus é visualmente o mesmo que já está sendo exibido, não precisamos fazer nada.
        if (areFileProcessingStatusStatesEqual(propStatus, displayedStatus)) {
            return;
        }
        
        // Se chegou aqui, propStatus é um novo estado visual.
        // Limpa qualquer timeout pendente para mudar para um estado anterior.
        if (displayTimeoutRef.current) {
            clearTimeout(displayTimeoutRef.current);
        }

        const now = Date.now();
        const timeSinceLastEffectiveChange = now - lastEffectiveDisplayChangeTimeRef.current;

        if (timeSinceLastEffectiveChange < MIN_DISPLAY_TIME) {
            const delay = MIN_DISPLAY_TIME - timeSinceLastEffectiveChange;
            displayTimeoutRef.current = setTimeout(() => {
                setDisplayedStatus(propStatus);
                lastEffectiveDisplayChangeTimeRef.current = Date.now(); // Marcar o tempo desta nova mudança efetiva
            }, delay);
        } else {
            // Tempo mínimo já passou ou é uma mudança para um estado diferente, atualiza imediatamente.
            setDisplayedStatus(propStatus);
            lastEffectiveDisplayChangeTimeRef.current = now; // Marcar o tempo desta nova mudança efetiva
        }

        return () => {
            if (displayTimeoutRef.current) {
                clearTimeout(displayTimeoutRef.current);
            }
        };
    }, [propStatus, displayedStatus, isMounted]); // displayedStatus e isMounted na dependência

    // A lógica de renderização agora usa `displayedStatus`
    const statusToRender = displayedStatus;

    if (statusToRender.type !== 'user_attachment_upload' && statusToRender.type !== 'file_from_function_processing') {
        return null;
    }

    let IconComponent = IoSyncOutline;
    let iconColor = "text-slate-400";
    let textColor = "text-slate-300";
    let bgColor = "bg-slate-700/50";
    let borderColor = "border-slate-600/80";
    let message = statusToRender.details || `Arquivo: ${statusToRender.name || 'desconhecido'}`;
    let animated = false;

    const fileNameForIcon = statusToRender.name || "";
    let fileSpecificIconUsed = false;
    let initialIconBasedOnFileType: typeof IoSyncOutline = IoDocumentTextOutline; // Default para arquivo genérico

    if (fileNameForIcon.match(/\.(jpg|jpeg|png|gif|webp)$/i)) { initialIconBasedOnFileType = IoImageOutline; fileSpecificIconUsed = true; }
    else if (fileNameForIcon.match(/\.(pdf|doc|docx|txt|md)$/i)) { initialIconBasedOnFileType = IoDocumentTextOutline; fileSpecificIconUsed = true; }
    else if (fileNameForIcon.match(/\.(mp3|wav|ogg|aac)$/i)) { initialIconBasedOnFileType = IoMusicalNotesOutline; fileSpecificIconUsed = true; }
    else if (fileNameForIcon.match(/\.(mp4|mov|avi|webm)$/i)) { initialIconBasedOnFileType = IoVideocamOutline; fileSpecificIconUsed = true; }
    
    IconComponent = initialIconBasedOnFileType; // Define o ícone base do tipo de arquivo

    switch (statusToRender.stage) {
        case 'pending':
            IconComponent = statusToRender.type === 'user_attachment_upload' ? IoCloudUploadOutline : IoSettingsOutline;
            message = statusToRender.details || `Iniciando: ${statusToRender.name || 'arquivo'}...`;
            iconColor = "text-amber-400";
            textColor = "text-amber-200";
            bgColor = "bg-amber-500/10";
            borderColor = "border-amber-500/30";
            animated = true;
            fileSpecificIconUsed = false;
            break;
        case 'in_progress':
            IconComponent = statusToRender.type === 'user_attachment_upload' ? IoCloudUploadOutline : IoSettingsOutline;
            message = statusToRender.details || `Processando: ${statusToRender.name || 'arquivo'}...`;
            iconColor = "text-purple-400";
            textColor = "text-purple-200";
            bgColor = "bg-purple-500/10";
            borderColor = "border-purple-500/30";
            animated = true;
            fileSpecificIconUsed = false;
            break;
        case 'awaiting_ai':
            IconComponent = fileSpecificIconUsed ? initialIconBasedOnFileType : IoEllipsisHorizontalCircleOutline;
            message = `${statusToRender.name || 'Arquivo'} pronto. Aguardando IA...`;
            iconColor = "text-green-400";
            textColor = "text-green-200";
            bgColor = "bg-green-500/10";
            borderColor = "border-green-500/30";
            animated = false;
            break;
        case 'completed':
            IconComponent = IoCheckmarkCircleOutline;
            message = `${statusToRender.name || 'Arquivo'} processado com sucesso.`;
            iconColor = "text-blue-400";
            textColor = "text-blue-200";
            bgColor = "bg-blue-500/10";
            borderColor = "border-blue-500/30";
            animated = false; // Geralmente não precisa mais animar após concluído
            fileSpecificIconUsed = false;
            break;
        case 'failed':
            IconComponent = IoCloseCircleOutline;
            message = `Falha - ${statusToRender.name || 'Arquivo'}: ${statusToRender.error || 'Erro desconhecido'}`;
            iconColor = "text-red-400";
            textColor = "text-red-200";
            bgColor = "bg-red-500/10";
            borderColor = "border-red-500/30";
            animated = false;
            fileSpecificIconUsed = false;
            break;
        default:
            // Se for um stage desconhecido, usa o ícone do tipo de arquivo ou um genérico
            message = `Status: ${statusToRender.stage} - ${statusToRender.name || 'Arquivo'}`;
            IconComponent = fileSpecificIconUsed ? initialIconBasedOnFileType : IoDocumentTextOutline;
            animated = false;
    }

    return (
        <div
            className={`file-processing-indicator flex items-center gap-2 p-2.5 my-1.5 rounded-lg border text-xs shadow-md
                        ${bgColor} ${borderColor} ${textColor}
                        transform transition-all duration-300 ease-out
                        ${isMounted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'}`}
            title={statusToRender.details || message}
        >
            <IconComponent className={`flex-shrink-0 text-lg ${iconColor} ${animated ? 'animate-spin' : ''}`} />
            <span className="truncate">{message}</span>
        </div>
    );
};

export default FileProcessingActivityIndicator;