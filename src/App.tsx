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
    const {
        allConversations,
        replaceAllConversations,
        lastConversationChangeSourceRef,
        resetLastConversationChangeSource
    } = useConversations();
    const {
        allMemories,
        replaceAllMemories,
        lastMemoryChangeSourceRef,
        resetLastMemoryChangeSource
    } = useMemories();

    // Instantiate useGoogleDriveSync here, so it's always active
    const { syncDriveData, triggerDebouncedSync } = useGoogleDriveSync({ // MODIFIED: Destructure triggerDebouncedSync
        memories: allMemories,
        replaceAllMemories,
        lastMemoryChangeSource: lastMemoryChangeSourceRef.current,
        resetLastMemoryChangeSource,
        conversations: allConversations,
        replaceAllConversations,
        lastConversationChangeSource: lastConversationChangeSourceRef.current,
        resetLastConversationChangeSource,
    });

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const isMobile = useIsMobile();

    const showNavigation = !settings.hideNavigation;

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

    const initialSyncPerformedRef = useRef(false); // ADDED: Ref to track if initial sync has been done

    // NEW: Trigger initial sync on component mount, only once when token is available
    useEffect(() => {
        if (settings.googleDriveAccessToken && !initialSyncPerformedRef.current) {
            console.log("Attempting initial Google Drive sync as token is available.");
            syncDriveData(); // Uses the direct, non-debounced syncDriveData for initial sync
            initialSyncPerformedRef.current = true;
        }
    }, [settings.googleDriveAccessToken, syncDriveData]);

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
                    syncDriveData={() => {
                        triggerDebouncedSync();
                        return Promise.resolve();
                    }} // MODIFIED: Pass debounced sync for manual trigger, wrapped to return Promise
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
