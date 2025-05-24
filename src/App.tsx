// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal';
import useIsMobile from './hooks/useIsMobile';
import React from 'react';
import { useUrlConfigInitializer } from './hooks/useUrlConfigInitializer';
import { useConversations } from './contexts/ConversationContext';
import { useAppSettings } from './contexts/AppSettingsContext';
// useDialog não é mais necessário em AppContent se ele não mostrar/esconder dialogs diretamente
import { DialogProvider } from './contexts/DialogContext';
// CustomDialog não é mais importado/usado diretamente em AppContent

const AppContent = () => {
    // const { dialogProps } = useDialog(); // NÃO MAIS NECESSÁRIO AQUI
    const { settings } = useAppSettings();
    const { conversations, createNewConversation, activeConversationId } = useConversations();

    // ... (resto do estado e lógica do AppContent permanece o mesmo)
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

    useEffect(() => {
        if (conversations && conversations.length === 0 && !activeConversationId) {
            console.log("No conversations found and no active conversation, creating a new one automatically.");
            createNewConversation();
        }
    }, [conversations, createNewConversation, activeConversationId]);


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
            {/* CustomDialog NÃO é mais renderizado aqui. O DialogProvider cuida disso via Portal. */}
            {/* {dialogProps && <CustomDialog {...dialogProps} />}  // REMOVA ESTA LINHA */}
        </>
    );
}

function App() {
    useUrlConfigInitializer();

    return (
        // DialogProvider agora envolve AppContent e gerencia a renderização do CustomDialog
        <DialogProvider>
            <AppContent />
        </DialogProvider>
    );
}

export default App;