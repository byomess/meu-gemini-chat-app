import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AppSettingsProvider } from './contexts/AppSettingsContext.tsx';
import { ConversationProvider } from './contexts/ConversationContext.tsx';
import { MemoryProvider } from './contexts/MemoryContext.tsx';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AppSettingsProvider>
            <MemoryProvider>
                <ConversationProvider>
                    <App />
                </ConversationProvider>
            </MemoryProvider>
        </AppSettingsProvider>
    </React.StrictMode>,
);