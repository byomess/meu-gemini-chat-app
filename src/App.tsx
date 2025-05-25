import { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal';
import useIsMobile from './hooks/useIsMobile';
import React from 'react';
import { useUrlConfigInitializer } from './hooks/useUrlConfigInitializer';
import { ConversationProvider, useConversations } from './contexts/ConversationContext';
import { AppSettingsProvider, useAppSettings } from './contexts/AppSettingsContext'; // Import AppSettingsProvider
import { DialogProvider } from './contexts/DialogContext';
import { MemoryProvider, useMemories } from './contexts/MemoryContext'; // Import MemoryProvider and useMemories
import { useGoogleDriveSync } from './hooks/useGoogleDriveSync';

const AppContent = () => {
    const { settings } = useAppSettings();
    const { conversations, createNewConversation, activeConversationId } = useConversations();
    const { memories } = useMemories(); // Get memories from context
    const { syncMemories } = useGoogleDriveSync();

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const isMobile = useIsMobile();

    const showNavigation = !settings.hideNavigation;

    // Ref to track if a sync is already in progress to prevent multiple simultaneous calls
    const isSyncingRef = useRef(false);

    const handleOpenSettingsModal = useCallback(() => {
        setIsSettingsModalOpen(true);
        if (isMobile) {
            setIsMobileSidebarOpen(false);
        }
    }, [isMobile]);

    const handleCloseSettingsModal = useCallback(() => {
        setIsSettingsModalOpen(false);
    }, []);

    const handleOpenMobileSidebar = useCallback(() => {
        if (showNavigation) {
            setIsMobileSidebarOpen(true);
        }
    }, [showNavigation]);

    const handleCloseMobileSidebar = useCallback(() => {
        setIsMobileSidebarOpen(false);
    }, []);

    const handleSelectConversationInMobile = useCallback(() => {
        setIsMobileSidebarOpen(false);
    }, []);

    useEffect(() => {
        const body = document.body;
        if (isMobileSidebarOpen && isMobile && showNavigation) {
            body.classList.add('mobile-sidebar-open');
        } else {
            body.classList.remove('mobile-sidebar-open');
        }
    }, [isMobileSidebarOpen, isMobile, showNavigation]);

    useEffect(() => {
        if (conversations && conversations.length === 0 && !activeConversationId) {
            console.log("No conversations found and no active conversation, creating a new one automatically.");
            createNewConversation();
        }
    }, [conversations, createNewConversation, activeConversationId]);

    // Trigger Google Drive sync on app startup if connected
    useEffect(() => {
        if (settings.googleDriveAccessToken && !isSyncingRef.current) {
            console.log("Google Drive access token found. Initiating sync on app startup.");
            isSyncingRef.current = true; // Set flag to true
            syncMemories().finally(() => {
                isSyncingRef.current = false; // Reset flag after sync completes
            });
        }
    }, [settings.googleDriveAccessToken, syncMemories]);

    // Trigger Google Drive sync when local memories change
    useEffect(() => {
        // This effect will run whenever 'memories' array reference changes.
        // We need to ensure it doesn't trigger on initial load or when syncMemories itself updates memories.
        // A simple debounce or a more sophisticated state management might be needed for production.
        // For MVP, we'll rely on the `isSyncingRef` to prevent immediate re-syncs.
        if (settings.googleDriveAccessToken && !isSyncingRef.current) {
            console.log("Local memories changed. Initiating Google Drive sync.");
            isSyncingRef.current = true; // Set flag to true
            syncMemories().finally(() => {
                isSyncingRef.current = false; // Reset flag after sync completes
            });
        }
    }, [memories, settings.googleDriveAccessToken, syncMemories]);


    return (
        <>
            <div className="flex h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white overflow-hidden">
                {/* ... Conteúdo do Sidebar e ChatArea ... */}
                 {!isMobile && showNavigation && (
                    <Sidebar
                        onOpenSettings={handleOpenSettingsModal}
                        isMobile={false}
                    />
                )}

                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <ChatArea
                        onOpenMobileSidebar={handleOpenMobileSidebar}
                        showMobileMenuButton={showNavigation}
                    />
                </div>

                {isMobile && showNavigation && (
                    <>
                        <div
                            className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out
                          ${isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                            onClick={handleCloseMobileSidebar}
                            aria-hidden="true"
                        ></div>

                        <Sidebar
                            onOpenSettings={handleOpenSettingsModal}
                            isMobile={true}
                            isOpen={isMobileSidebarOpen}
                            onCloseMobile={handleCloseMobileSidebar}
                            onSelectConversation={handleSelectConversationInMobile}
                        />
                    </>
                )}

                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={handleCloseSettingsModal}
                />
            </div>
        </>
    );
}

function App() {
    useUrlConfigInitializer();

    return (
        // Correct nesting of providers
        <AppSettingsProvider>
            <MemoryProvider>
                <DialogProvider>
                    <ConversationProvider>
                        <AppContent />
                    </ConversationProvider>
                </DialogProvider>
            </MemoryProvider>
        </AppSettingsProvider>
    );
}

export default App;
