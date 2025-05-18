// src/hooks/useLocalStorage.ts
import { useState, useEffect, useRef, useCallback } from 'react';

const DB_NAME = 'appPersistentStorageDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyValueStore';

interface DBEntry {
    key: string;
    value: string;
}

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

async function getValueFromDB<TValue>(db: IDBDatabase, key: string): Promise<TValue | undefined> {
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
            if (result && typeof result.value === 'string') { // Checar se value é string antes de parse
                try {
                    // console.log(`[DB GET] Key: ${key}, Raw: ${result.value}`);
                    resolve(JSON.parse(result.value) as TValue);
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
            reject((event.target as IDBRequest).error); // Rejeitar para o catch do chamador
        };
    });
}

async function setValueInDB(db: IDBDatabase, key: string, value: unknown): Promise<void> { // value é unknown porque T pode ser qualquer coisa
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
            // console.log(`[DB SET] Key: ${key}, Stringified: ${valueToStoreString}`);
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
    initialValueProp: T | (() => T) // Renomeado para distinguir da ref
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [dbInstance, setDbInstance] = useState<IDBDatabase | null>(null);
    // Flag para indicar se a carga inicial do DB para esta chave foi concluída
    const [isLoadedFromDB, setIsLoadedFromDB] = useState<boolean>(false);

    // Armazena a prop initialValue em uma ref para ter a versão mais recente sem causar re-run do efeito de load
    const initialValueRef = useRef(initialValueProp);
    useEffect(() => {
        initialValueRef.current = initialValueProp;
    }, [initialValueProp]);

    const [storedValue, setStoredValue] = useState<T>(() => {
        // Na inicialização síncrona, não podemos ler do IndexedDB.
        // Usamos o initialValueProp diretamente.
        const currentInitial = initialValueRef.current; // Usa a ref que já tem o valor da prop
        return currentInitial instanceof Function ? currentInitial() : currentInitial;
    });

    // Efeito para abrir o banco de dados
    useEffect(() => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            console.warn('IndexedDB is not available. State will be in-memory only.');
            setIsLoadedFromDB(true); // Considera "carregado" para desbloquear saves, mesmo que seja só em memória
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
                    setIsLoadedFromDB(true); // Mesmo em erro, marca como "tentativa de carga feita"
                }
            });
        return () => { didCancel = true; };
    }, []);

    // Efeito para CARREGAR o valor do IndexedDB
    useEffect(() => {
        if (!dbInstance || !key) {
            // Se não há DB ou chave, não faz nada.
            // Se o DB falhou em abrir, isLoadedFromDB será true e não entraremos no `else` abaixo para carregar.
            return;
        }

        // Se já carregamos do DB para esta chave e instância de DB, não recarregue desnecessariamente.
        // A menos que a chave ou dbInstance mude, o que fará este efeito rodar novamente.
        // A flag `isLoadedFromDB` é resetada implicitamente se key/dbInstance mudar (ver próximo useEffect).

        let didCancel = false;
        // console.log(`[LOAD EFFECT] Attempting to load for key: ${key}. isLoadedFromDB: ${isLoadedFromDB}`);

        // Este efeito só deve realmente carregar uma vez por combinação de key/dbInstance,
        // ou se quisermos explicitamente ouvir mudanças externas (o que não é o caso aqui).
        // A flag isLoadedFromDB ajuda a controlar isso.

        getValueFromDB<T>(dbInstance, key)
            .then(valueFromDB => {
                if (didCancel) return;
                // console.log(`[LOAD EFFECT] Loaded for key: ${key}, valueFromDB:`, valueFromDB);
                if (valueFromDB !== undefined) {
                    setStoredValue(valueFromDB);
                } else {
                    // Valor não encontrado no DB, usamos o initialValue da ref
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
                // console.log(`[LOAD EFFECT] Finished load attempt for key: ${key}. Setting isLoadedFromDB = true.`);
                setIsLoadedFromDB(true); // Marca que a tentativa de carga (bem-sucedida ou não) terminou
            });

        return () => {
            didCancel = true;
            // console.log(`[LOAD EFFECT] Cleanup for key: ${key}`);
        };
    // A dependência principal é key e dbInstance. initialValueRef é estável.
    // isLoadedFromDB NÃO deve estar aqui, pois queremos que este efeito rode para popular o estado
    // e então setar isLoadedFromDB. Se isLoadedFromDB estivesse aqui, e fosse true, o efeito não rodaria.
    }, [key, dbInstance]);


    // Efeito para resetar isLoadedFromDB se a chave ou dbInstance mudar, para forçar recarga.
    useEffect(() => {
        setIsLoadedFromDB(false);
    }, [key, dbInstance]);


    // Efeito para SALVAR o valor no IndexedDB
    useEffect(() => {
        // Não salva se:
        // - Não há instância do DB.
        // - Não há chave.
        // - A carga inicial do DB para esta chave ainda não foi concluída (isLoadedFromDB é false).
        //   Isso previne salvar o initialValue de volta ao DB antes de tentar carregar o valor real do DB.
        if (!dbInstance || !key || !isLoadedFromDB) {
            /*
            console.log(`[SAVE EFFECT] Skipped save for key: ${key}. Conditions:`, {
                hasDb: !!dbInstance,
                hasKey: !!key,
                isLoaded: isLoadedFromDB,
            });
            */
            return;
        }

        // console.log(`[SAVE EFFECT] Attempting to save for key: ${key}, value:`, storedValue);
        setValueInDB(dbInstance, key, storedValue)
            .then(() => {
                // console.log(`[SAVE EFFECT] Successfully saved for key: ${key}`);
            })
            .catch(error => {
                console.warn(`Error setting IndexedDB key “${key}” during save:`, error);
            });

    // Salva quando storedValue muda (após a carga inicial E se db/key estiverem ok)
    // Também depende de key e dbInstance para garantir que estamos salvando no lugar certo se eles mudarem.
    // E isLoadedFromDB para garantir que a carga inicial aconteceu.
    }, [key, storedValue, dbInstance, isLoadedFromDB]);

    const setVal: React.Dispatch<React.SetStateAction<T>> = useCallback((valueOrFn) => {
        // Quando o usuário chama setStoredValue, queremos que `isLoadedFromDB` seja true
        // para que o save effect possa rodar imediatamente se as outras condições forem satisfeitas.
        // Se a carga inicial ainda não aconteceu, ela vai acontecer, e depois o save effect
        // pegará o valor mais recente de storedValue.
        // Não é necessário forçar `setIsLoadedFromDB(true)` aqui, pois o save effect já depende disso.
        setStoredValue(valueOrFn);
    }, []);


    return [storedValue, setVal];
}