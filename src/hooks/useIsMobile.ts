// src/hooks/useIsMobile.ts
import { useState, useEffect } from 'react';

// Defina o breakpoint mobile (por exemplo, 768px, que é o md do Tailwind)
const MOBILE_BREAKPOINT = 768;

const useIsMobile = (): boolean => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // Verifica na montagem inicial
        checkIsMobile();

        // Adiciona listener para redimensionamento da tela
        window.addEventListener('resize', checkIsMobile);

        // Limpa o listener na desmontagem
        return () => {
            window.removeEventListener('resize', checkIsMobile);
        };
    }, []);

    return isMobile;
};

export default useIsMobile;
