import React from 'react';
import { IoChatbubblesOutline } from 'react-icons/io5';

export const NoMessagesDisplay: React.FC = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-[var(--color-no-messages-text-main)] p-6 text-center">
            <IoChatbubblesOutline size={48} className="mb-4 opacity-50 text-[var(--color-no-messages-icon)]" />
            <p className="text-lg font-medium">Nenhuma mensagem ainda.</p>
            <p className="text-sm max-w-xs">Envie uma mensagem abaixo para iniciar a conversa.</p>
        </div>
    );
};
