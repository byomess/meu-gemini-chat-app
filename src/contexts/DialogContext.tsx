// src/contexts/DialogContext.tsx
import React, { createContext, useState, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CustomDialog, { type CustomDialogProps } from '../components/common/CustomDialog';

export type DialogOptions = Omit<CustomDialogProps, 'isOpen' | 'onClose'> & {
    onAfterClose?: () => void;
};

interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
  isDialogActive: boolean; // NOVA FLAG
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

const PORTAL_ID = 'custom-dialog-portal-root';

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogConfig, setDialogConfig] = useState<CustomDialogProps | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let node = document.getElementById(PORTAL_ID);
    let nodeCreated = false;
    if (!node) {
      nodeCreated = true;
      node = document.createElement('div');
      node.setAttribute('id', PORTAL_ID);
      document.body.appendChild(node);
    }
    setPortalNode(node);

    return () => {
      if (nodeCreated && node?.parentNode) {
        node.parentNode.removeChild(node);
      }
    };
  }, []);

  const internalHideDialog = useCallback(() => {
    setDialogConfig(prevConfig => {
      return prevConfig ? { ...prevConfig, isOpen: false } : null;
    });
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    const { onAfterClose, ...restOptions } = options;
    setDialogConfig({
      ...restOptions,
      isOpen: true,
      onClose: () => {
        internalHideDialog();
        if (onAfterClose) {
          onAfterClose();
        }
      },
    });
  }, [internalHideDialog]);

  const hideDialog = internalHideDialog;

  // Determina se um diálogo está "ativo" (visível ou em processo de fechamento com animação)
  const isDialogActive = !!(dialogConfig && dialogConfig.isOpen);

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog, isDialogActive }}> {/* ADICIONADO isDialogActive */}
      {children}
      {portalNode && dialogConfig && ( // dialogConfig ainda controla a renderização
        createPortal(
          <CustomDialog {...dialogConfig} />,
          portalNode
        )
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};