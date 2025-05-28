/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Define PeriodicSyncEvent if not globally available
interface PeriodicSyncEvent extends ExtendableEvent {
    readonly tag: string;
}

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Constants for IndexedDB and Periodic Sync
const DB_NAME = 'LooxAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'scheduledNotifications';
const GENERIC_SYNC_TAG = 'loox-notification-check'; // Must match the tag used in nativeFunctions.ts

// Define the structure of a scheduled notification for type safety within the SW
interface ScheduledNotification {
    id: string;
    type: string; // e.g., 'productivity-tip'
    targetIntervalMs: number;
    nextTriggerTime: number;
    messagePrompt: string; // Prompt for AI to generate message, or the message itself
    currentMessage: string; // Potentially AI-generated message
    messageVariations: string[];
    lastVariationIndex: number;
    enabled: boolean;
    createdAt: number;
}

function showNotification(title: string, body: string, tag?: string) {
    if (Notification.permission === 'granted') {
        self.registration.showNotification(title, {
            body: body,
            icon: '/pwa-192x192.png',
            tag: tag || 'sw-notification',
        });
    } else {
        console.log(`Service Worker: Notification permission not granted. Cannot show: ${title}`);
    }
}

// --- IndexedDB Utility Functions ---

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = self.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Ensure the object store exists, matching the frontend setup
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                console.log(`Service Worker: Object store ${STORE_NAME} created during onupgradeneeded.`);
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            console.error("Service Worker: IndexedDB error:", (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
}

function getScheduledNotifications(db: IDBDatabase): Promise<ScheduledNotification[]> {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.warn(`Service Worker: Object store "${STORE_NAME}" not found during get. Returning empty array.`);
            resolve([]);
            return;
        }
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll() as IDBRequest<ScheduledNotification[]>;

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = (event) => {
            console.error("Service Worker: Error fetching scheduled notifications:", (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
    });
}

function updateScheduledNotification(db: IDBDatabase, notification: ScheduledNotification): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.error(`Service Worker: Object store "${STORE_NAME}" not found during update. Cannot update notification.`);
            reject(new Error(`Object store "${STORE_NAME}" not found.`));
            return;
        }
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(notification);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error("Service Worker: Error updating scheduled notification:", (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
    });
}


// --- Main Periodic Sync Logic ---

async function handlePeriodicSyncLogic() {
    console.log('Service Worker: Periodic sync event triggered for', GENERIC_SYNC_TAG);
    let db: IDBDatabase | null = null;
    try {
        db = await openDB();
        const notifications = await getScheduledNotifications(db);
        const now = Date.now();

        console.log(`Service Worker: Found ${notifications.length} scheduled notifications to check.`);

        for (const notification of notifications) {
            if (notification.enabled && now >= notification.nextTriggerTime) {
                console.log(`Service Worker: Triggering notification for ID: ${notification.id} (Type: ${notification.type})`);
                
                // For now, use the messagePrompt as the body.
                // Future enhancement: Use notification.currentMessage if populated by an AI,
                // or call AI here to generate a message based on notification.messagePrompt.
                showNotification(
                    `Lembrete Agendado: ${notification.type}`, // Title
                    notification.messagePrompt,                // Body
                    notification.id                            // Tag (unique ID for the notification)
                );

                // Update next trigger time
                notification.nextTriggerTime = now + notification.targetIntervalMs;
                await updateScheduledNotification(db, notification);
                console.log(`Service Worker: Notification ${notification.id} rescheduled for ${new Date(notification.nextTriggerTime).toLocaleString()}`);
            } else if (notification.enabled) {
                // console.log(`Service Worker: Notification ${notification.id} not yet due (due at ${new Date(notification.nextTriggerTime).toLocaleString()}).`);
            } else {
                // console.log(`Service Worker: Notification ${notification.id} is disabled.`);
            }
        }
        console.log('Service Worker: Finished processing scheduled notifications.');
    } catch (error) {
        console.error('Service Worker: Error during periodic sync handling:', error);
    } finally {
        if (db) {
            db.close();
        }
    }
}

self.skipWaiting();
clientsClaim();

// Ensure API calls to Google Generative Language are handled by the network directly
console.log('[SW] Attempting to register Google API route...');
registerRoute(
  ({url}) => {
    console.log(`[SW] Google API Route Predicate CHECKING URL: ${url.href} (Origin: ${url.origin})`);
    const isGoogleApi = url.origin === 'https://generativelanguage.googleapis.com';
    if (isGoogleApi) {
      console.log('[SW] Google API call MATCHED by origin for NetworkOnly strategy:', url.href);
    }
    return isGoogleApi;
  },
  new NetworkOnly()
);
console.log('[SW] Google API route registration attempt COMPLETE.');

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

self.addEventListener('activate', (event) => {
    console.log('Periodic Notification Test Service Worker activated.');
    showNotification(
        'Service Worker Ativado', // Changed to Portuguese
        'O Service Worker para notificações proativas está ativo.' // Changed to Portuguese
    );
    console.log('Service Worker: Activated. Ready for periodic sync events.');
    event.waitUntil(self.clients.claim());
});

// Remove old message listeners for start/stop test as they are no longer needed.

// Listen for the periodic sync event
self.addEventListener('periodicsync', (event: Event) => {
    // Assert the event to our custom PeriodicSyncEvent type
    const periodicSyncEvent = event as PeriodicSyncEvent;

    if (periodicSyncEvent.tag === GENERIC_SYNC_TAG) {
        console.log('Service Worker: Received periodic sync event for tag:', periodicSyncEvent.tag);
        periodicSyncEvent.waitUntil(handlePeriodicSyncLogic());
    } else {
        console.log('Service Worker: Received periodic sync event for an unknown tag:', periodicSyncEvent.tag);
    }
});
