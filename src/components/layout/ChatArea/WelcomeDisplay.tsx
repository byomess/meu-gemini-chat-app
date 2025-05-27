import React from 'react';

interface WelcomeDisplayProps {
    isMobile: boolean;
    showMobileMenuButton: boolean;
    logoSrc: string;
    logoAlt: string;
}

export const WelcomeDisplay: React.FC<WelcomeDisplayProps> = ({ isMobile, showMobileMenuButton, logoSrc, logoAlt }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-[var(--color-welcome-text-secondary)] p-6 text-center">
            <img
                src={logoSrc}
                alt={logoAlt}
                className="py-4 w-36 h-auto opacity-70"
            />
            <p className="text-lg font-medium text-[var(--color-welcome-text-main)]">Bem-vindo, aluno!</p>
            <p className="text-sm max-w-xs text-[var(--color-welcome-text-secondary)] mt-4">
                {isMobile && showMobileMenuButton
                    ? "Toque no ícone de menu no canto superior esquerdo para ver suas conversas ou iniciar uma nova."
                    : "Crie uma nova conversa ou selecione uma existente no painel à esquerda para começar."
                }
            </p>
        </div>
    );
};
