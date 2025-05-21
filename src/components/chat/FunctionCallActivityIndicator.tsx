// src/components/chat/FunctionCallActivityIndicator.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { ProcessingStatus } from '../../types';
import { IoTerminalOutline, IoCheckmarkCircleOutline, IoCloseCircleOutline, IoSyncOutline, IoHardwareChipOutline, IoEllipsisHorizontalCircleOutline } from 'react-icons/io5';

interface FunctionCallActivityIndicatorProps {
    status: ProcessingStatus;
}

const MIN_DISPLAY_TIME = 1000;

const areStatusStatesEqual = (s1: ProcessingStatus, s2: ProcessingStatus): boolean => {
    if (!s1 || !s2) return s1 === s2;

    const isValidType = (status: ProcessingStatus) =>
        status.type === 'function_call_request' ||
        status.type === 'function_call_execution' ||
        status.type === 'function_call_response';

    if (!isValidType(s1) || !isValidType(s2)) {
        return s1 === s2; // Should be handled by MessageBubble's type switching
    }

    // Campos que definem o "estado visual principal" para o timer de 500ms do filho.
    // 'details' é omitido aqui para o timer, mas será usado na renderização da mensagem.
    return s1.type === s2.type &&
           s1.stage === s2.stage &&
           s1.name === s2.name && // Nome da função pode ser parte da identidade do estado
           (s1.error ? String(s1.error) : '') === (s2.error ? String(s2.error) : ''); // Erro define um estado visual
};


const FunctionCallActivityIndicator: React.FC<FunctionCallActivityIndicatorProps> = ({ status: propStatus }) => {
    const [displayedStatus, setDisplayedStatus] = useState<ProcessingStatus>(propStatus);
    const [isMounted, setIsMounted] = useState(false);
    const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastEffectiveDisplayChangeTimeRef = useRef<number>(0);

    useEffect(() => {
        setIsMounted(true);
        setDisplayedStatus(propStatus);
        lastEffectiveDisplayChangeTimeRef.current = Date.now();
    }, []); // Apenas na montagem

    useEffect(() => {
        if (!isMounted) {
            return;
        }

        // Se o propStatus representa o mesmo "estado visual principal" que já está sendo exibido,
        // apenas atualizamos o displayedStatus para pegar os 'details' mais recentes, sem resetar o timer.
        if (areStatusStatesEqual(propStatus, displayedStatus)) {
            // Se o objeto propStatus é realmente diferente (ex: 'details' mudou), atualiza.
            if (JSON.stringify(propStatus) !== JSON.stringify(displayedStatus)) {
                setDisplayedStatus(propStatus);
            }
            return;
        }
        
        // Se chegou aqui, propStatus é um novo estado visual principal.
        if (displayTimeoutRef.current) {
            clearTimeout(displayTimeoutRef.current);
        }

        const now = Date.now();
        const timeSinceLastEffectiveChange = now - lastEffectiveDisplayChangeTimeRef.current;

        if (timeSinceLastEffectiveChange < MIN_DISPLAY_TIME) {
            const delay = MIN_DISPLAY_TIME - timeSinceLastEffectiveChange;
            displayTimeoutRef.current = setTimeout(() => {
                setDisplayedStatus(propStatus);
                lastEffectiveDisplayChangeTimeRef.current = Date.now(); 
            }, delay);
        } else {
            setDisplayedStatus(propStatus);
            lastEffectiveDisplayChangeTimeRef.current = now; 
        }

        return () => {
            if (displayTimeoutRef.current) {
                clearTimeout(displayTimeoutRef.current);
            }
        };
    }, [propStatus, displayedStatus, isMounted]);


    const currentStatusToRender = displayedStatus;

    // A lógica de filtragem de tipo já deve estar no MessageBubble, mas como defesa:
    if (currentStatusToRender.type !== 'function_call_execution' && 
        currentStatusToRender.type !== 'function_call_response' &&
        !(currentStatusToRender.type === 'function_call_request' && currentStatusToRender.stage === 'failed')) {
        return null;
    }

    let IconComponent = IoSyncOutline;
    let iconColor = "text-slate-400";
    let textColor = "text-slate-300";
    let bgColor = "bg-slate-700/50";
    let borderColor = "border-slate-600/80";
    let message = currentStatusToRender.details || `Função: ${currentStatusToRender.name || 'desconhecida'}`;
    let animated = false;

    if (currentStatusToRender.type === 'function_call_request' && currentStatusToRender.stage === 'failed') {
        IconComponent = IoCloseCircleOutline;
        message = `Falha ao solicitar ${currentStatusToRender.name || 'função'}: ${currentStatusToRender.error || 'Não encontrada'}`;
        iconColor = "text-red-400";
        textColor = "text-red-200";
        bgColor = "bg-red-500/10";
        borderColor = "border-red-500/30";
    } else if (currentStatusToRender.type === 'function_call_execution') {
        switch (currentStatusToRender.stage) {
            case 'pending':
                IconComponent = IoTerminalOutline;
                message = currentStatusToRender.details || `Iniciando: ${currentStatusToRender.name || 'função'}...`;
                iconColor = "text-amber-400";
                textColor = "text-amber-200";
                bgColor = "bg-amber-500/10";
                borderColor = "border-amber-500/30";
                animated = true;
                break;
            case 'in_progress':
                IconComponent = IoHardwareChipOutline;
                message = currentStatusToRender.details || `Executando: ${currentStatusToRender.name || 'função'}...`;
                iconColor = "text-purple-400";
                textColor = "text-purple-200";
                bgColor = "bg-purple-500/10";
                borderColor = "border-purple-500/30";
                animated = true;
                break;
            case 'completed':
                IconComponent = IoCheckmarkCircleOutline;
                message = currentStatusToRender.details || `${currentStatusToRender.name || 'Função'} executada. Processando resposta...`;
                iconColor = "text-blue-400";
                textColor = "text-blue-200";
                bgColor = "bg-blue-500/10";
                borderColor = "border-blue-500/30";
                animated = true; 
                break;
            case 'failed':
                IconComponent = IoCloseCircleOutline;
                message = `Falha em ${currentStatusToRender.name || 'função'}: ${currentStatusToRender.error || 'Erro desconhecido'}`;
                iconColor = "text-red-400";
                textColor = "text-red-200";
                bgColor = "bg-red-500/10";
                borderColor = "border-red-500/30";
                animated = false;
                break;
            default:
                message = `Status execução: ${currentStatusToRender.stage} - ${currentStatusToRender.name || 'Função'}`;
        }
    } else if (currentStatusToRender.type === 'function_call_response') {
        if (currentStatusToRender.stage === 'awaiting_ai') {
            IconComponent = IoEllipsisHorizontalCircleOutline;
            message = currentStatusToRender.details || `${currentStatusToRender.name || 'Função'} concluída. Aguardando IA...`;
            iconColor = "text-green-400";
            textColor = "text-green-200";
            bgColor = "bg-green-500/10";
            borderColor = "border-green-500/30";
            animated = false;
        } else if (currentStatusToRender.stage === 'failed') {
            IconComponent = IoCloseCircleOutline;
            message = `IA falhou ao processar resp. de ${currentStatusToRender.name || 'função'}: ${currentStatusToRender.error || 'Erro'}`;
            iconColor = "text-red-400";
            textColor = "text-red-200";
            bgColor = "bg-red-500/10";
            borderColor = "border-red-500/30";
            animated = false;
        } else {
            return null; 
        }
    }
     return (
        <div
            className={`function-call-indicator flex items-center gap-2 p-2.5 my-1.5 rounded-lg border text-xs shadow-md
                        ${bgColor} ${borderColor} ${textColor}
                        transform transition-all duration-300 ease-out
                        ${isMounted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'}`}
            title={currentStatusToRender.details || message}
        >
            <IconComponent className={`flex-shrink-0 text-lg ${iconColor} ${animated ? 'animate-spin' : ''}`} />
            <span className="truncate">{message}</span>
        </div>
    );
};

export default FunctionCallActivityIndicator;