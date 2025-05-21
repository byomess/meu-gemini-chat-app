// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal';
import useIsMobile from './hooks/useIsMobile';
import React from 'react';
import { useUrlConfigInitializer } from './hooks/useUrlConfigInitializer'; // Import the hook
import { useConversations } from './contexts/ConversationContext'; // Import useConversations
import { useAppSettings } from './contexts/AppSettingsContext'; // Import useAppSettings

function App() {
  useUrlConfigInitializer(); // Call the hook to initialize config from URL

  const { conversations, createNewConversation, activeConversationId } = useConversations(); // Get conversation context
  const { settings } = useAppSettings(); // Get app settings

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // The showNavigation state is now derived from settings.hideNavigation
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
    if (showNavigation) { // Only open if navigation is shown (derived from settings)
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
    // Use showNavigation (derived from settings)
    if (isMobileSidebarOpen && isMobile && showNavigation) {
      body.classList.add('mobile-sidebar-open');
    } else {
      body.classList.remove('mobile-sidebar-open');
    }
  }, [isMobileSidebarOpen, isMobile, showNavigation]);

  // Effect to automatically create a new conversation if none exist on load
  useEffect(() => {
    if (conversations && conversations.length === 0 && !activeConversationId) {
      console.log("No conversations found and no active conversation, creating a new one automatically.");
      createNewConversation();
    }
  }, [conversations, createNewConversation, activeConversationId]);

  return (
    <div className="flex h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white overflow-hidden">
      
      {!isMobile && showNavigation && ( // Use showNavigation (derived from settings)
        <Sidebar
            onOpenSettings={handleOpenSettingsModal}
            isMobile={false}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
         <ChatArea 
            onOpenMobileSidebar={handleOpenMobileSidebar}
            showMobileMenuButton={showNavigation}  // Use showNavigation (derived from settings)
         />
      </div>

      {isMobile && showNavigation && ( // Use showNavigation (derived from settings)
        <>
          {/* Overlay para fechar o sidebar ao clicar fora */}
          {/* A transição de opacidade é controlada aqui */}
          <div 
            className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out
                        ${isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={handleCloseMobileSidebar}
            aria-hidden="true"
          ></div>
          
          {/* Sidebar Mobile */}
          {/* O Sidebar em si controla sua própria transição de translate-x com base na prop isOpen */}
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
  );
}

export default App;
