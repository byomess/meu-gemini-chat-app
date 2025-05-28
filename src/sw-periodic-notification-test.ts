/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// workbox imports
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// --- Push Event Listener ---
self.addEventListener('push', (event: PushEvent) => {
    console.log('[Service Worker] Push Received.');
    if (!event.data) {
        console.warn('[Service Worker] Push event but no data');
        // Optionally show a generic notification if no data is present
        event.waitUntil(
            self.registration.showNotification('Nova mensagem', {
                body: 'Você tem uma nova atualização.',
                icon: '/pwa-192x192.png',
                tag: 'generic-push-fallback'
            })
        );
        return;
    }

    let pushData;
    try {
        pushData = event.data.json();
        console.log('[Service Worker] Push data: ', pushData);
    } catch {
        console.error('[Service Worker] Failed to parse push data as JSON. Data:', event.data.text());
        // Fallback for non-JSON data or parse error
        pushData = { title: 'Nova Notificação', body: event.data.text() };
    }

    const title = pushData.title || 'Nova Notificação';
    const options: NotificationOptions = {
        body: pushData.body || 'Você recebeu uma nova mensagem.',
        icon: pushData.icon || '/pwa-192x192.png', // Default icon
        badge: pushData.badge || '/pwa-72x72.png', // Example badge, ensure this asset exists
        tag: pushData.tag || 'general-push-notification', // Tag to group notifications
        data: pushData.data || null, // Any additional data associated with the notification
        // actions: pushData.actions || [] // Example: [{ action: 'explore', title: 'Explore' }]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});


// --- Service Worker Lifecycle ---

self.skipWaiting();
clientsClaim();

// Ensure API calls to Google Generative Language are handled by the network directly
console.log('[SW] Attempting to register Google API route with RegExp...');
registerRoute(
  new RegExp('^https://generativelanguage\\.googleapis\\.com'),
  new NetworkOnly()
);
console.log('[SW] Google API route registered using RegExp for NetworkOnly strategy.');

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

self.addEventListener('activate', (event) => {
    console.log('Push Notification Service Worker activated.');
    event.waitUntil(
        self.clients.claim().then(() => {
            console.log('Service Worker: Claimed clients.');
            // Removed the showNotification call from here as it's not directly related to the push mechanism.
            if ('PushManager' in self.registration) {
                console.log('Service Worker: Activated. PushManager is available.');
            } else {
                console.log('Service Worker: Activated. PushManager may not be supported or available.');
            }
        })
    );
});

// Listener for notification clicks (optional, but good practice)
self.addEventListener('notificationclick', (event: NotificationEvent) => {
    console.log('[Service Worker] Notification click Received.', event.notification.tag);
    event.notification.close(); // Close the notification

    // Example: Open a specific URL or focus an existing window
    // You can use event.notification.data to pass URLs or other info
    const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});

console.log('Service Worker: Event listeners for push and notificationclick attached.');
