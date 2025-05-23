// src/components/chat/InputErrorDisplay.tsx
import React from 'react';
import { IoWarningOutline } from 'react-icons/io5';

interface InputErrorDisplayProps {
    aiError: string | null;
    audioError: string | null;
}

const InputErrorDisplay: React.FC<InputErrorDisplayProps> = ({ aiError, audioError }) => {
    if (!aiError && !audioError) {
        return null;
    }

    return (
        <>
            {aiError && (
                <div className="mb-2 p-2 text-xs text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0 text-base" /> <span>{aiError}</span>
                </div>
            )}
            {audioError && (
                <div className="mb-2 p-2 text-xs text-[var(--color-warning-text)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0 text-base" /> <span>{audioError}</span>
                </div>
            )}
        </>
    );
};

export default InputErrorDisplay;
