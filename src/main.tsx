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
