// src/contexts/DialogContext.tsx
import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import type { CustomDialogProps } from '../components/common/CustomDialog'; // Adjust path as needed

// Exclude isOpen and onClose from DialogOptions as they are managed by the context
type DialogOptions = Omit<CustomDialogProps, 'isOpen' | 'onClose'> & {
    onCloseCallback?: () => void; // Optional callback when dialog is closed by any means
};


interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
  dialogProps: CustomDialogProps | null;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogProps, setDialogProps] = useState<CustomDialogProps | null>(null);
  const [onCloseCallback, setOnCloseCallback] = useState<(() => void) | undefined>(undefined);


  const hideDialog = useCallback(() => {
    setDialogProps(prevProps => {
      if (prevProps?.isOpen && onCloseCallback) {
        onCloseCallback();
      }
      return prevProps ? { ...prevProps, isOpen: false } : null;
    });
    setOnCloseCallback(undefined);
    // Optional: Delay clearing props if you have animations
    // setTimeout(() => setDialogProps(null), 300); 
  }, [onCloseCallback]);

  const showDialog = useCallback((options: DialogOptions) => {
    const { onCloseCallback: customOnClose, ...restOptions } = options;
    setOnCloseCallback(() => customOnClose); // Store the custom onClose callback

    setDialogProps({
      ...restOptions,
      isOpen: true,
      onClose: hideDialog, // Internal onClose always calls hideDialog
    });
  }, [hideDialog]);


  return (
    <DialogContext.Provider value={{ showDialog, hideDialog, dialogProps }}>
      {children}
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
