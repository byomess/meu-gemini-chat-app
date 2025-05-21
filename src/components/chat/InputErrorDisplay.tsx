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
                <div className="mb-2 p-2 text-xs text-red-700 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0 text-base" /> <span>{aiError}</span>
                </div>
            )}
            {audioError && (
                <div className="mb-2 p-2 text-xs text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-md flex items-center gap-2">
                    <IoWarningOutline className="flex-shrink-0 text-base" /> <span>{audioError}</span>
                </div>
            )}
        </>
    );
};

export default InputErrorDisplay;
