import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import SettingsModal from './components/settings/SettingsModal'; // Importar o modal

function App() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const handleOpenSettingsModal = () => {
    setIsSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-white selection:bg-blue-500 selection:text-white">
      <Sidebar onOpenSettings={handleOpenSettingsModal} /> {/* Passar a função */}
      <ChatArea />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
      />
    </div>
  );
}

export default App;