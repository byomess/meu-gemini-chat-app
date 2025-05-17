// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal';
import useIsMobile from './hooks/useIsMobile';

function App() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

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
    setIsMobileSidebarOpen(true);
  }, []);

  const handleCloseMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);
  
  const handleSelectConversationInMobile = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    const body = document.body;
    if (isMobileSidebarOpen && isMobile) {
      body.classList.add('mobile-sidebar-open');
    } else {
      body.classList.remove('mobile-sidebar-open');
    }
  }, [isMobileSidebarOpen, isMobile]);

  return (
    <div className="flex h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white overflow-hidden">
      
      {!isMobile && (
        <Sidebar
            onOpenSettings={handleOpenSettingsModal}
            isMobile={false}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
         <ChatArea 
            onOpenMobileSidebar={handleOpenMobileSidebar} 
         />
      </div>

      {isMobile && (
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