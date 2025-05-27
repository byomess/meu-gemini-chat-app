import React from 'react';
import { IoLockClosedOutline } from 'react-icons/io5';

export const ApiKeyMissingDisplay: React.FC = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-[var(--color-api-key-missing-text)] p-6 text-center">
            <IoLockClosedOutline size={48} className="mb-4 opacity-70 text-[var(--color-api-key-missing-icon)]" />
            <p className="text-lg font-medium">Chave de API necessária</p>
            <p className="text-sm max-w-xs">
                Configure sua chave do Google Gemini nas <strong>Configurações</strong> para ativar o
                chat.
            </p>
        </div>
    );
};
