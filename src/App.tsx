// src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal';
// Removido useLocalStorage e SIDEBAR_COLLAPSED_KEY
import useIsMobile from './hooks/useIsMobile';

// Removida a constante SIDEBAR_COLLAPSED_KEY

function App() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // Removidos os estados e useLocalStorage relacionados ao colapso do desktop
  // const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useLocalStorage<boolean>(...);

  // Mobile: estado de abertura do modal lateral (mantido)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const isMobile = useIsMobile(); // Usa o hook

  const handleOpenSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
    // No mobile, ao abrir configurações, fechar o sidebar modal
    if (isMobile) {
      setIsMobileSidebarOpen(false);
    }
  }, [isMobile]);

  const handleCloseSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(false);
  }, []);

  // Removidas as funções de toggle da sidebar desktop
  // const handleToggleDesktopSidebar = useCallback(() => {...}, [...]);

  // Funções para o modal lateral (apenas no mobile) - Mantidas
  const handleOpenMobileSidebar = useCallback(() => {
      setIsMobileSidebarOpen(true);
  }, []);

  const handleCloseMobileSidebar = useCallback(() => {
      setIsMobileSidebarOpen(false);
  }, []);
  
  // Handler quando uma conversa é selecionada no mobile, fecha o modal - Mantido
  const handleSelectConversationInMobile = useCallback(() => {
      setIsMobileSidebarOpen(false);
  }, []);


  // Adiciona/remove classe no body para desabilitar scroll quando o modal mobile está aberto
  // Removida a lógica para desktop-sidebar-collapsed
  useEffect(() => {
    const body = document.body;

    // Lida com o estado aberto do mobile (para desabilitar scroll do body)
    if (isMobileSidebarOpen) {
        body.classList.add('mobile-sidebar-open');
    } else {
        body.classList.remove('mobile-sidebar-open');
    }

    // Não é mais necessário limpar classes de desktop, pois não as estamos adicionando aqui.
    // window.dispatchEvent(new Event('resize')); 
  }, [isMobileSidebarOpen]); // Dependência simplificada

  return (
    // Removida a classe que controlava a margem baseada no colapso desktop
    <div className="flex h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white overflow-hidden">
      
      {/* Sidebar - Renderização Condicional de Layout */}
      {isMobile ? (
        // Modo Mobile: Sidebar como Overlay Condicional
        isMobileSidebarOpen && (
            <>
              {/* Overlay de fundo clicável para fechar */}
              <div 
                className="fixed inset-0 bg-black/50 z-40" 
                onClick={handleCloseMobileSidebar}
                aria-hidden="true"
              ></div>
              {/* Sidebar no modo Mobile */}
              <Sidebar
                  onOpenSettings={handleOpenSettingsModal}
                  isMobile={true}
                  onCloseMobile={handleCloseMobileSidebar}
                  onSelectConversation={handleSelectConversationInMobile}
                   // Props de colapso desktop removidos
              />
            </>
        )
      ) : (
        // Modo Desktop: Sidebar Fixo e SEMPRE Expandido
        <Sidebar
            onOpenSettings={handleOpenSettingsModal}
            isMobile={false}
             // Props de colapso desktop removidos (isCollapsed e onToggleCollapse)
             // Props mobile removidos
        />
      )}

      {/* ChatArea - Passar prop para abrir sidebar mobile */}
      {/* A div wrapper para ChatArea pode ser necessária ou não dependendo do CSS */}
      {/* Se Sidebar desktop for fixo, ChatArea flex-1 funcionará sem margem aqui. */}
      <div className="flex-1 transition-all duration-300 ease-in-out">
         <ChatArea onOpenMobileSidebar={handleOpenMobileSidebar} />
      </div>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
      />
    </div>
  );
}

export default App;