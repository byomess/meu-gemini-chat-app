// src/hooks/useLocalStorage.ts
import { useState, useEffect, useRef, useCallback } from 'react';

const DB_NAME = 'appPersistentStorageDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyValueStore';

interface DBEntry {
    key: string;
    value: string;
}

// Generic reviver function to convert ISO date strings back to Date objects
const dateReviver = (key: string, value: any): any => {
    if (typeof value === 'string') {
        const dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.exec(value);
        if (dateMatch) {
            return new Date(value);
        }
    }
    return value;
};

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB is not supported.'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = (event) => {
            console.error('IndexedDB error opening DB:', (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
}

async function getValueFromDB<TValue>(db: IDBDatabase, key: string, reviver?: (key: string, value: any) => any): Promise<TValue | undefined> {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.warn(`Object store "${STORE_NAME}" not found during get. Returning undefined.`);
            resolve(undefined);
            return;
        }
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key) as IDBRequest<DBEntry | undefined>;

        request.onsuccess = (event) => {
            const result = (event.target as IDBRequest<DBEntry | undefined>).result;
            if (result && typeof result.value === 'string') {
                try {
                    resolve(JSON.parse(result.value, reviver) as TValue); // Pass reviver here
                } catch (error) {
                    console.warn(`Error parsing IndexedDB value for key “${key}”:`, error, `Raw value: "${result.value}"`);
                    resolve(undefined);
                }
            } else {
                resolve(undefined);
            }
        };
        request.onerror = (event) => {
            console.error(`Error getting value for key "${key}" from IndexedDB:`, (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
    });
}

async function setValueInDB(db: IDBDatabase, key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.error(`Object store "${STORE_NAME}" not found during set. Cannot set value.`);
            reject(new Error(`Object store "${STORE_NAME}" not found.`));
            return;
        }
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        try {
            const valueToStoreString = JSON.stringify(value);
            const entry: DBEntry = { key, value: valueToStoreString };
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = (event) => {
                console.error(`Error setting value for key "${key}" in IndexedDB:`, (event.target as IDBRequest).error);
                reject((event.target as IDBRequest).error);
            };
        } catch (error) {
            console.warn(`Error stringifying value for IndexedDB key “${key}”:`, error);
            reject(error);
        }
    });
}

export function useLocalStorage<T>(
    key: string,
    initialValueProp: T | (() => T),
    reviver?: (key: string, value: any) => any // New optional parameter
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [dbInstance, setDbInstance] = useState<IDBDatabase | null>(null);
    const [isLoadedFromDB, setIsLoadedFromDB] = useState<boolean>(false);

    const initialValueRef = useRef(initialValueProp);
    useEffect(() => {
        initialValueRef.current = initialValueProp;
    }, [initialValueProp]);

    const [storedValue, setStoredValue] = useState<T>(() => {
        const currentInitial = initialValueRef.current;
        return currentInitial instanceof Function ? currentInitial() : currentInitial;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            console.warn('IndexedDB is not available. State will be in-memory only.');
            setIsLoadedFromDB(true);
            return;
        }
        let didCancel = false;
        openDB()
            .then(db => {
                if (!didCancel) setDbInstance(db);
            })
            .catch(error => {
                if (!didCancel) {
                    console.error("Failed to open DB for useLocalStorage:", error);
                    setIsLoadedFromDB(true);
                }
            });
        return () => { didCancel = true; };
    }, []);

    useEffect(() => {
        if (!dbInstance || !key) {
            return;
        }

        let didCancel = false;

        getValueFromDB<T>(dbInstance, key, reviver) // Pass reviver here
            .then(valueFromDB => {
                if (didCancel) return;
                if (valueFromDB !== undefined) {
                    setStoredValue(valueFromDB);
                } else {
                    const currentInitial = initialValueRef.current;
                    setStoredValue(currentInitial instanceof Function ? currentInitial() : currentInitial);
                }
            })
            .catch(error => {
                if (didCancel) return;
                console.warn(`Error reading IndexedDB key “${key}” during load, falling back to initialValue:`, error);
                const currentInitial = initialValueRef.current;
                setStoredValue(currentInitial instanceof Function ? currentInitial() : currentInitial);
            })
            .finally(() => {
                if (didCancel) return;
                setIsLoadedFromDB(true);
            });

        return () => {
            didCancel = true;
        };
    }, [key, dbInstance, reviver]); // Add reviver to dependencies

    useEffect(() => {
        setIsLoadedFromDB(false);
    }, [key, dbInstance]);

    useEffect(() => {
        if (!dbInstance || !key || !isLoadedFromDB) {
            return;
        }

        setValueInDB(dbInstance, key, storedValue)
            .then(() => {
                // console.log(`[SAVE EFFECT] Successfully saved for key: ${key}`);
            })
            .catch(error => {
                console.warn(`Error setting IndexedDB key “${key}” during save:`, error);
            });
    }, [key, storedValue, dbInstance, isLoadedFromDB]);

    const setVal: React.Dispatch<React.SetStateAction<T>> = useCallback((valueOrFn) => {
        setStoredValue(valueOrFn);
    }, []);

    return [storedValue, setVal];
}
