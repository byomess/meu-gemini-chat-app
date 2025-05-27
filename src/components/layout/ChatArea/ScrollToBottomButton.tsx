import React from 'react';
import { IoArrowDownCircleOutline } from 'react-icons/io5';

interface ScrollToBottomButtonProps {
    isVisible: boolean;
    onClick: () => void;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({ isVisible, onClick }) => {
    if (!isVisible) {
        return null;
    }

    return (
        <button
            onClick={onClick}
            className={`
                fixed bottom-24 right-6 sm:right-8 z-30
                p-3 rounded-full
                shadow-lg shadow-[var(--color-floating-button-shadow)]
                text-[var(--color-floating-button-text)]
                hover:scale-105 active:scale-95
                transition-all duration-150 ease-in-out
                bg-gradient-to-br from-[var(--color-floating-button-default-from)] to-[var(--color-floating-button-default-to)]
            `}
            title="Rolar para o fim"
            aria-label="Rolar para o fim"
        >
            <IoArrowDownCircleOutline size={24} />
        </button>
    );
};
