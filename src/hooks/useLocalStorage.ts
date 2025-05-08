// src/hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

function getValueFromLocalStorage<T>(key: string, initialValue: T | (() => T)): T {
    try {
        const item = window.localStorage.getItem(key);
        if (item) {
            return JSON.parse(item) as T;
        }
    } catch (error) {
        console.warn(`Error reading localStorage key “${key}”:`, error);
    }

    return initialValue instanceof Function ? initialValue() : initialValue;
}

export function useLocalStorage<T>(
    key: string,
    initialValue: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        return getValueFromLocalStorage(key, initialValue);
    });

    useEffect(() => {
        try {
            const valueToStore =
                storedValue instanceof Function
                    ? (storedValue as () => T)()
                    : storedValue;
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
}
