import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AppSettingsProvider } from './contexts/AppSettingsContext.tsx';
import { ConversationProvider } from './contexts/ConversationContext.tsx';
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

// ADD: Import registerSW
import { registerSW } from 'virtual:pwa-register';

// ADD: Periodic SW update logic
const intervalMS = 60 * 60 * 1000; // Check every hour

registerSW({
    onRegisteredSW(swUrl, r) {
        r && setInterval(async () => {
            if (!(!r.installing && navigator)) return; // Simplified check

            if (('connection' in navigator) && !navigator.onLine) return;

            const resp = await fetch(swUrl, {
                cache: 'no-store',
                headers: {
                    'cache': 'no-store',
                    'cache-control': 'no-cache',
                },
            });

            if (resp?.status === 200) {
                await r.update();
            }
        }, intervalMS);
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
