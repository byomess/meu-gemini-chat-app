import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal';
import useIsMobile from './hooks/useIsMobile';
import React from 'react';
import { useUrlConfigInitializer } from './hooks/useUrlConfigInitializer';
import { ConversationProvider, useConversations } from './contexts/ConversationContext';
import { AppSettingsProvider, useAppSettings } from './contexts/AppSettingsContext';
import { DialogProvider } from './contexts/DialogContext';
import { MemoryProvider, useMemories } from './contexts/MemoryContext';
import { useGoogleDriveSync } from './hooks/useGoogleDriveSync';

const AppContent = () => {
    const { settings } = useAppSettings();
    const { conversations, createNewConversation, activeConversationId } = useConversations();
    const { memories } = useMemories();
    const { syncMemories } = useGoogleDriveSync();

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const isMobile = useIsMobile();

    const showNavigation = !settings.hideNavigation;

    // Ref to track if a sync is already in progress to prevent multiple simultaneous calls
    const isSyncingRef = useRef(false);
    // Ref to hold the debounce timer
    const syncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    // Ref to store the memories array as it was after the last successful sync
    const lastSyncedMemoriesRef = useRef<typeof memories>([]); // Initialize with an empty array

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

    // Callback to update lastSyncedMemoriesRef
    const onSyncCompleteUpdateRef = useCallback((syncedMemories: typeof memories) => {
        lastSyncedMemoriesRef.current = syncedMemories;
    }, []);

    // Trigger Google Drive sync on app startup if connected
    useEffect(() => {
        if (settings.googleDriveAccessToken && !isSyncingRef.current) {
            console.log("Google Drive access token found. Initiating sync on app startup.");
            isSyncingRef.current = true; // Set flag to true
            syncMemories(onSyncCompleteUpdateRef).finally(() => { // Pass the callback
                isSyncingRef.current = false; // Reset flag after sync completes
            });
        }
    }, [settings.googleDriveAccessToken, syncMemories, onSyncCompleteUpdateRef]);

    // Trigger Google Drive sync when local memories change with debounce
    useEffect(() => {
        // If the current memories array is the same reference as the last synced one,
        // it means this change was caused by the sync itself, so don't re-trigger.
        if (memories === lastSyncedMemoriesRef.current) {
            console.log("Memories change detected, but it was from a sync. Skipping re-trigger.");
            return;
        }
        // Clear any existing debounce timer
        if (syncDebounceTimerRef.current) {
            clearTimeout(syncDebounceTimerRef.current);
        }

        // Only trigger sync if connected and not already syncing
        if (settings.googleDriveAccessToken) {
            // Set a new debounce timer
            syncDebounceTimerRef.current = setTimeout(() => {
                if (!isSyncingRef.current) {
                    console.log("Local memories changed. Initiating Google Drive sync after debounce (user-initiated).");
                    isSyncingRef.current = true; // Set flag to true
                    syncMemories(onSyncCompleteUpdateRef).finally(() => { // Pass the callback
                        isSyncingRef.current = false; // Reset flag after sync completes
                    });
                }
            }, 300000); // 5-minute debounce delay (5 * 60 * 1000 ms)
        }

        // Cleanup function to clear the timer if the component unmounts or dependencies change
        return () => {
            if (syncDebounceTimerRef.current) {
                clearTimeout(syncDebounceTimerRef.current);
            }
        };
    }, [memories, settings.googleDriveAccessToken, syncMemories, onSyncCompleteUpdateRef]);


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
