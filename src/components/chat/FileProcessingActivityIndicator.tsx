// src/components/chat/FileProcessingActivityIndicator.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { ProcessingStatus } from '../../types';
import {
    IoCloudUploadOutline,
    IoDocumentTextOutline,
    IoSyncOutline,
    IoCheckmarkCircleOutline,
    IoCloseCircleOutline,
    IoImageOutline,
    IoMusicalNotesOutline,
    IoVideocamOutline,
    IoHourglassOutline, // For pending
    IoRocketOutline, // For awaiting_ai
} from 'react-icons/io5';

interface FileProcessingActivityIndicatorProps {
    status: ProcessingStatus;
}

const MIN_STAGE_DISPLAY_TIME = 700; // ms

const FileProcessingActivityIndicator: React.FC<FileProcessingActivityIndicatorProps> = ({ status }) => {
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

    let StageSpecificIconComponent;
    let iconColorClass = 'text-[var(--color-gray-500)]';
    let textColorClass = 'text-[var(--color-gray-700)]';
    let bgColorClass = 'bg-[var(--color-gray-100)]';
    let borderColorClass = 'border-[var(--color-gray-300)]';
    let stageText = '';
    let showSpinner = false;

    // Determine main icon based on file type
    const fileNameForIcon = status.name || "";
    let FileTypeIconComponent: React.ElementType = IoDocumentTextOutline; // Default
    if (fileNameForIcon.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) { FileTypeIconComponent = IoImageOutline; }
    else if (fileNameForIcon.match(/\.(mp3|wav|ogg|aac|flac)$/i)) { FileTypeIconComponent = IoMusicalNotesOutline; }
    else if (fileNameForIcon.match(/\.(mp4|mov|avi|webm|mkv)$/i)) { FileTypeIconComponent = IoVideocamOutline; }
    
    let titleIconColorClass = 'text-[var(--color-gray-600)]'; // Default for the main FileTypeIconComponent

    // Determine stage-specific icon, colors, and text
    switch (displayedStage) {
        case 'pending':
            StageSpecificIconComponent = IoHourglassOutline;
            iconColorClass = 'text-[var(--color-amber-600)]';
            textColorClass = 'text-[var(--color-amber-700)]';
            bgColorClass = 'bg-[var(--color-amber-50)]';
            borderColorClass = 'border-[var(--color-amber-200)]';
            stageText = status.type === 'user_attachment_upload' ? 'Envio Pendente...' : 'Processamento Pendente...';
            showSpinner = true;
            titleIconColorClass = 'text-[var(--color-amber-600)]';
            break;
        case 'in_progress':
            StageSpecificIconComponent = status.type === 'user_attachment_upload' ? IoCloudUploadOutline : IoSyncOutline;
            iconColorClass = status.type === 'user_attachment_upload' ? 'text-[var(--color-primary)]' : 'text-[var(--color-primary)]';
            textColorClass = status.type === 'user_attachment_upload' ? 'text-[var(--color-primary-dark)]' : 'text-[var(--color-primary-dark)]';
            bgColorClass = status.type === 'user_attachment_upload' ? 'bg-[color:color-mix(in_srgb,var(--color-primary)_5%,transparent)]' : 'bg-[color:color-mix(in_srgb,var(--color-primary)_5%,transparent)]';
            borderColorClass = status.type === 'user_attachment_upload' ? 'border-[color:color-mix(in_srgb,var(--color-primary)_30%,transparent)]' : 'border-[color:color-mix(in_srgb,var(--color-primary)_30%,transparent)]';
            stageText = status.type === 'user_attachment_upload' ? 'Enviando...' : 'Processando...';
            showSpinner = true;
            titleIconColorClass = status.type === 'user_attachment_upload' ? 'text-[var(--color-primary)]' : 'text-[var(--color-primary)]';
            break;
        case 'awaiting_ai':
            StageSpecificIconComponent = IoRocketOutline;
            iconColorClass = 'text-[var(--color-purple-500)]';
            textColorClass = 'text-[var(--color-purple-600)]';
            bgColorClass = 'bg-[color:color-mix(in_srgb,var(--color-purple-500)_5%,transparent)]';
            borderColorClass = 'border-[color:color-mix(in_srgb,var(--color-purple-500)_30%,transparent)]';
            stageText = 'Aguardando IA...';
            showSpinner = true;
            titleIconColorClass = 'text-[var(--color-purple-600)]';
            break;
        case 'completed':
            StageSpecificIconComponent = IoCheckmarkCircleOutline;
            iconColorClass = 'text-[var(--color-green-500)]';
            textColorClass = 'text-[var(--color-emerald-600)]';
            bgColorClass = 'bg-[color:color-mix(in_srgb,var(--color-green-500)_5%,transparent)]';
            borderColorClass = 'border-[color:color-mix(in_srgb,var(--color-green-500)_30%,transparent)]';
            stageText = status.type === 'user_attachment_upload' ? 'Envio Concluído' : 'Processamento Concluído';
            titleIconColorClass = 'text-[var(--color-green-500)]';
            break;
        case 'failed':
            StageSpecificIconComponent = IoCloseCircleOutline;
            iconColorClass = 'text-[var(--color-red-500)]';
            textColorClass = 'text-[var(--color-red-700)]';
            bgColorClass = 'bg-[var(--color-red-50)]';
            borderColorClass = 'border-[var(--color-red-300)]';
            stageText = status.type === 'user_attachment_upload' ? 'Falha no Envio' : 'Falha no Processamento';
            titleIconColorClass = 'text-[var(--color-red-600)]';
            break;
        default:
            StageSpecificIconComponent = IoDocumentTextOutline; // Fallback
            stageText = `Status: ${displayedStage || 'Indefinido'}`;
    }
    
    const fileName = status.name || "Arquivo";
    const details = status.details || '';
    const errorDetails = displayedStage === 'failed' ? (status.error || 'Erro desconhecido') : '';

    return (
        <div className={`file-processing-indicator p-3 my-2 rounded-lg border text-xs shadow-sm transition-all duration-300 ease-in-out ${bgColorClass} ${borderColorClass}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <FileTypeIconComponent size={18} className={`flex-shrink-0 ${titleIconColorClass}`} />
                <span className={`font-semibold ${textColorClass}`}>
                    {status.type === 'user_attachment_upload' ? 'Upload de Arquivo: ' : 'Processando Arquivo (Função): '}
                    {fileName}
                </span>
            </div>
            <div className="pl-[calc(1.125rem+0.5rem)] space-y-1"> {/* Indent content under title */}
                <div className="flex items-center gap-1.5">
                    {showSpinner ? (
                        <IoSyncOutline size={15} className={`animate-spin ${iconColorClass}`} />
                    ) : (
                        <StageSpecificIconComponent size={15} className={`${iconColorClass}`} />
                    )}
                    <span className={`${textColorClass} font-medium`}>{stageText}</span>
                </div>
                {details && <p className={`text-xs ${textColorClass} opacity-80`}>{details}</p>}
                {errorDetails && <p className="text-xs text-[var(--color-red-700)] opacity-90"><strong>Erro:</strong> {errorDetails}</p>}
            </div>
        </div>
    );
};

export default FileProcessingActivityIndicator;
