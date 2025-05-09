// src/App.tsx
import { useState, useEffect } from 'react'; // Adicionar useEffect
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal';
import { useLocalStorage } from './hooks/useLocalStorage'; // Importar useLocalStorage

const SIDEBAR_COLLAPSED_KEY = 'geminiChat_sidebarCollapsed';

function App() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // Usar localStorage para persistir o estado da sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage<boolean>(
    SIDEBAR_COLLAPSED_KEY,
    false // Sidebar começa expandida por padrão
  );

  const handleOpenSettingsModal = () => {
    setIsSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  // Adiciona uma classe ao body para estilos globais se a sidebar estiver colapsada,
  // ou para o layout principal se adaptar.
  useEffect(() => {
    if (isSidebarCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    // Disparar um evento de resize pode ajudar alguns componentes a se re-renderizarem corretamente
    // window.dispatchEvent(new Event('resize')); // Usar com cautela, pode ter implicações de performance
  }, [isSidebarCollapsed]);


  return (
    <div className="flex h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white overflow-hidden"> {/* overflow-hidden para evitar scroll duplo */}
      <Sidebar
        onOpenSettings={handleOpenSettingsModal}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      {/* Adicionar uma div wrapper para a ChatArea pode ajudar com transições ou margens */}
      <div className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-0' : 'ml-0'}`}> 
        {/* O ml-0 é porque a sidebar tem position fixed/absolute ou ajusta seu próprio tamanho.
            Se a sidebar empurrasse o conteúdo, aqui seria ml-larguraDaSidebar */}
        <ChatArea />
      </div>
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
      />
    </div>
  );
}

export default App;