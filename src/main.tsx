import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AppSettingsProvider } from './contexts/AppSettingsContext.tsx';
import { ConversationProvider } './contexts/ConversationContext.tsx';
import { MemoryProvider } from './contexts/MemoryContext.tsx';

import './index.css';
import './themes/aulapp.css'; // Import the light theme CSS
import "./themes/loox.css"; // Import the dark theme CSS
import "./themes/dracula-dark.css" // ADDED: Import the dracula-dark theme CSS
import "./themes/solarized-light.css"; // ADDED: Import the solarized-light theme CSS
import "./themes/one-dark.css"; // ADDED: Import the one-dark theme CSS
import "./themes/github-light.css"; // ADDED: Import the github-light theme CSS
import "./themes/shades-of-purple.css"; // ADDED: Import the shades-of-purple theme CSS
import "./themes/shades-of-purple-light.css"; // ADDED: Import the shades-of-purple-light theme CSS
import "./themes/nebula.css"; // UPDATED: Import the nebula theme CSS

import { registerSW } from 'virtual:pwa-register';

// --- Push Notification Subscription Logic ---

// IMPORTANT: Replace this with your actual VAPID public key from your push server
const VAPID_PUBLIC_KEY = 'YOUR_SERVER_VAPID_PUBLIC_KEY_HERE';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported');
        return;
    }
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'YOUR_SERVER_VAPID_PUBLIC_KEY_HERE') {
        console.error('VAPID_PUBLIC_KEY is not set. Please set it to your server\'s VAPID public key.');
        // alert('Push notification setup error: VAPID key missing.'); // Optional user alert
        return;
    }

    try {
        const permissionResult = await Notification.requestPermission();
        if (permissionResult !== 'granted') {
            console.log('Notification permission not granted by the user.');
            // Optionally, inform the user that notifications are disabled
            // alert('Você não receberá notificações pois a permissão foi negada.');
            return;
        }
        console.log('Notification permission granted.');

        const registration = await navigator.serviceWorker.ready;
        console.log('Service Worker ready for push subscription.');

        let subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            console.log('User is already subscribed:', subscription);
            // You might want to re-send the subscription to your server here
            // if there's a chance it wasn't synced, or if your server needs periodic updates.
        } else {
            console.log('User not subscribed. Attempting to subscribe...');
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey as BufferSource, // Type assertion added here
            });
            console.log('User subscribed successfully:', subscription);
        }

        // Send the subscription to your backend server
        // IMPORTANT: Replace 'http://localhost:5000/subscribe' with your actual server endpoint
        const PUSH_SERVER_SUBSCRIBE_URL = 'http://localhost:5000/subscribe';
        await fetch(PUSH_SERVER_SUBSCRIBE_URL, {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
            },
        });
        console.log('Subscription details sent to the server.');
        // alert('Inscrito para notificações com sucesso!'); // Optional user feedback

    } catch (error) {
        console.error('Error during push notification subscription:', error);
        // alert('Falha ao se inscrever para notificações.'); // Optional user feedback
    }
}

// --- Service Worker Registration and Update ---
const intervalMS = 60 * 60 * 1000; // Check for SW updates every hour

registerSW({
    onRegisteredSW(swUrl, registration) {
        console.log(`Service Worker registered: ${swUrl}`);
        if (registration) {
            // Once the SW is registered and active, attempt to subscribe to push notifications.
            // This ensures that we have an active SW registration to work with.
            subscribeToPushNotifications();

            // Existing SW update check logic
            setInterval(async () => {
                if (!registration.installing && navigator) { // Simplified check
                    if (('connection' in navigator) && !navigator.onLine) return;

                    try {
                        const resp = await fetch(swUrl, {
                            cache: 'no-store',
                            headers: {
                                'cache': 'no-store',
                                'cache-control': 'no-cache',
                            },
                        });

                        if (resp?.status === 200) {
                            await registration.update();
                            console.log('Service Worker update check: Update found and applied or no update needed.');
                        }
                    } catch (e) {
                        console.error('Service Worker update check: Failed to fetch SW file.', e);
                    }
                }
            }, intervalMS);
        }
    },
    onRegisterError(error) {
        console.error('Service Worker registration failed:', error);
    }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <AppSettingsProvider>
                <MemoryProvider>
                    <ConversationProvider>
                        <App />
                    </ConversationProvider>
                </MemoryProvider>
            </AppSettingsProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
