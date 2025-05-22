import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage'; // Assuming useLocalStorage is in this path

interface ThemeContextType {
    isDarkModeEnabled: boolean;
    toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    // Use a key specific to theme settings
    const [storedDarkMode, setStoredDarkMode] = useLocalStorage<boolean>('appSettings.isDarkModeEnabled', false);
    const [isDarkModeEnabled, setIsDarkModeEnabled] = useState<boolean>(storedDarkMode);

    // Sync state with local storage whenever it changes
    useEffect(() => {
        setStoredDarkMode(isDarkModeEnabled);
    }, [isDarkModeEnabled, setStoredDarkMode]);

    // Apply or remove 'dark' class on the root html element
    useEffect(() => {
        const root = document.documentElement;
        if (isDarkModeEnabled) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [isDarkModeEnabled]);

    const toggleDarkMode = useCallback(() => {
        setIsDarkModeEnabled(prev => !prev);
    }, []);

    return (
        <ThemeContext.Provider value={{ isDarkModeEnabled, toggleDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
