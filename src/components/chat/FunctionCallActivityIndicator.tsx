// src/components/chat/FunctionCallActivityIndicator.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { ProcessingStatus } from '../../types';
import { IoTerminalOutline, IoCheckmarkCircleOutline, IoCloseCircleOutline, IoSyncOutline, IoHardwareChipOutline, IoRocketOutline, IoHourglassOutline } from 'react-icons/io5';

interface FunctionCallActivityIndicatorProps {
    status: ProcessingStatus;
}

const MIN_STAGE_DISPLAY_TIME = 700; // ms

const FunctionCallActivityIndicator: React.FC<FunctionCallActivityIndicatorProps> = ({ status }) => {
    const [displayedStage, setDisplayedStage] = useState<ProcessingStatus['stage']>(status.stage);
    const stageChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastStageSetTimeRef = useRef<number>(0);

    useEffect(() => {
        if (status.stage && displayedStage !== status.stage && lastStageSetTimeRef.current === 0) {
            setDisplayedStage(status.stage);
            lastStageSetTimeRef.current = Date.now();
        }
    }, [status.stage, displayedStage]);


    useEffect(() => {
        if (stageChangeTimeoutRef.current) {
            clearTimeout(stageChangeTimeoutRef.current);
        }

        if (displayedStage !== status.stage) {
            const now = Date.now();
            const timeSinceLastStageSet = now - lastStageSetTimeRef.current;

            if (timeSinceLastStageSet < MIN_STAGE_DISPLAY_TIME && lastStageSetTimeRef.current !== 0) {
                const delay = MIN_STAGE_DISPLAY_TIME - timeSinceLastStageSet;
                stageChangeTimeoutRef.current = setTimeout(() => {
                    setDisplayedStage(status.stage);
                    lastStageSetTimeRef.current = Date.now();
                }, delay);
            } else {
                setDisplayedStage(status.stage);
                lastStageSetTimeRef.current = now;
            }
        } else {
            setDisplayedStage(status.stage);
        }

        return () => {
            if (stageChangeTimeoutRef.current) {
                clearTimeout(stageChangeTimeoutRef.current);
            }
        };
    }, [status.stage, displayedStage]);


    let IconComponent;
    let iconColorClass = 'text-[var(--color-gray-500)]';
    let textColorClass = 'text-[var(--color-gray-700)]';
    let bgColorClass = 'bg-[var(--color-gray-100)]';
    let borderColorClass = 'border-[var(--color-gray-300)]';
    let stageText = '';
    let showSpinner = false;
    let titleIconColorClass = 'text-[var(--color-gray-600)]'; // Default for the main IoTerminalOutline

    // This check should ideally be handled by the parent, but as a safeguard:
    if (status.type !== 'function_call_request' &&
        status.type !== 'function_call_execution' &&
        status.type !== 'function_call_response') {
        return null;
    }
    
    // Specific handling for function_call_request failure, as it might not go through other stages
    if (status.type === 'function_call_request' && displayedStage === 'failed') {
        IconComponent = IoCloseCircleOutline;
        iconColorClass = 'text-[var(--color-red-500)]';
        textColorClass = 'text-[var(--color-red-700)]';
        bgColorClass = 'bg-[var(--color-red-50)]';
        borderColorClass = 'border-[var(--color-red-300)]';
        stageText = 'Falha na Solicitação';
        titleIconColorClass = 'text-[var(--color-red-600)]';
    } else {
        switch (displayedStage) {
            case 'pending':
                IconComponent = IoHourglassOutline;
                iconColorClass = 'text-[var(--color-amber-600)]';
                textColorClass = 'text-[var(--color-amber-700)]';
                bgColorClass = 'bg-[var(--color-amber-50)]';
                borderColorClass = 'border-[var(--color-amber-200)]';
                stageText = 'Pendente...';
                showSpinner = true;
                titleIconColorClass = 'text-[var(--color-amber-600)]';
                break;
            case 'in_progress':
                IconComponent = IoHardwareChipOutline; // More specific for execution
                iconColorClass = 'text-[var(--color-primary)]';
                textColorClass = 'text-[var(--color-primary-dark)]';
                bgColorClass = 'bg-[color:color-mix(in_srgb,var(--color-primary)_5%,transparent)]';
                borderColorClass = 'border-[color:color-mix(in_srgb,var(--color-primary)_30%,transparent)]';
                stageText = 'Executando...';
                showSpinner = true;
                titleIconColorClass = 'text-[var(--color-primary)]';
                break;
            case 'awaiting_ai': // Typically for function_call_response
                IconComponent = IoRocketOutline;
                iconColorClass = 'text-[var(--color-purple-500)]';
                textColorClass = 'text-[var(--color-purple-600)]';
                bgColorClass = 'bg-[color:color-mix(in_srgb,var(--color-purple-500)_5%,transparent)]';
                borderColorClass = 'border-[color:color-mix(in_srgb,var(--color-purple-500)_30%,transparent)]';
                stageText = 'Aguardando IA...';
                showSpinner = true; 
                titleIconColorClass = 'text-[var(--color-purple-600)]';
                break;
            case 'completed': // Typically for function_call_execution before response
                IconComponent = IoCheckmarkCircleOutline;
                iconColorClass = 'text-[var(--color-green-500)]';
                textColorClass = 'text-[var(--color-emerald-600)]';
                bgColorClass = 'bg-[color:color-mix(in_srgb,var(--color-green-500)_5%,transparent)]';
                borderColorClass = 'border-[color:color-mix(in_srgb,var(--color-green-500)_30%,transparent)]';
                stageText = 'Execução Concluída';
                titleIconColorClass = 'text-[var(--color-green-500)]';
                break;
            case 'failed':
                IconComponent = IoCloseCircleOutline;
                iconColorClass = 'text-[var(--color-red-500)]';
                textColorClass = 'text-[var(--color-red-700)]';
                bgColorClass = 'bg-[var(--color-red-50)]';
                borderColorClass = 'border-[var(--color-red-300)]';
                stageText = 'Falhou';
                titleIconColorClass = 'text-[var(--color-red-600)]';
                break;
            default:
                IconComponent = IoTerminalOutline; // Fallback
                stageText = `Status: ${displayedStage || 'Indefinido'}`;
        }
    }


    const functionName = status.name || "Função Desconhecida";
    const details = status.details || '';
    const errorDetails = displayedStage === 'failed' ? (status.error || 'Erro desconhecido') : '';

    return (
        <div className={`function-call-indicator p-3 my-2 rounded-lg border text-xs shadow-sm transition-all duration-300 ease-in-out ${bgColorClass} ${borderColorClass}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <IoTerminalOutline size={18} className={`flex-shrink-0 ${titleIconColorClass}`} />
                <span className={`font-semibold ${textColorClass}`}>Chamada de Função: {functionName}</span>
            </div>
            <div className="pl-[calc(1.125rem+0.5rem)] space-y-1"> {/* Indent content under title */}
                <div className="flex items-center gap-1.5">
                    {showSpinner ? (
                        <IoSyncOutline size={15} className={`animate-spin ${iconColorClass}`} />
                    ) : (
                        <IconComponent size={15} className={`${iconColorClass}`} />
                    )}
                    <span className={`${textColorClass} font-medium`}>{stageText}</span>
                </div>
                {details && <p className={`text-xs ${textColorClass} opacity-80`}>{details}</p>}
                {errorDetails && <p className="text-xs text-[var(--color-red-700)] opacity-90"><strong>Erro:</strong> {errorDetails}</p>}
            </div>
        </div>
    );
};

export default FunctionCallActivityIndicator;
