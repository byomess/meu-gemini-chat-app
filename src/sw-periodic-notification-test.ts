/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

const NOTIFICATION_INTERVAL_MS = 10 * 1000;
let periodicNotificationIntervalId: number | undefined;

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

function handlePeriodicNotification() {
    const time = new Date().toLocaleTimeString();
    console.log(`Service Worker: Attempting to show periodic notification at ${time}`);
    showNotification(
        'Periodic SW Test',
        `Notification from Service Worker at ${time}`,
        'sw-periodic-test-notification'
    );
}

function startPeriodicNotifications() {
    if (periodicNotificationIntervalId) {
        clearInterval(periodicNotificationIntervalId);
    }
    periodicNotificationIntervalId = self.setInterval(handlePeriodicNotification, NOTIFICATION_INTERVAL_MS);
    console.log('Periodic notification task started.');
}

function stopPeriodicNotifications() {
    if (periodicNotificationIntervalId) {
        clearInterval(periodicNotificationIntervalId);
        periodicNotificationIntervalId = undefined;
        console.log('Periodic notification task stopped.');
    }
}

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

self.addEventListener('activate', (event) => {
    console.log('Periodic Notification Test Service Worker activated.');
    showNotification(
        'Service Worker Activated',
        'Periodic notification test SW is now active.'
    );
    startPeriodicNotifications();
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'STOP_PERIODIC_NOTIFICATION_TEST') {
        stopPeriodicNotifications();
        console.log('Periodic notification test interval stopped by client message.');
    }
    if (event.data && event.data.type === 'START_PERIODIC_NOTIFICATION_TEST') {
        startPeriodicNotifications();
        console.log('Periodic notification test interval started by client message.');
    }
});
