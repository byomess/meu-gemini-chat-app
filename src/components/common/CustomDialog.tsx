// src/components/common/CustomDialog.tsx
import React from 'react';
import Button from './Button'; // Assuming you have a reusable Button component

export interface CustomDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  onClose: () => void; // For simple dismissal or when a choice is made
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  onCancel?: () => void; // Could be the same as onClose if no specific cancel action
  type?: 'alert' | 'confirm';
}

const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  title,
  message,
  onClose,
  confirmText = 'OK',
  onConfirm,
  cancelText = 'Cancel',
  onCancel,
  type = 'alert',
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose(); // Always close after confirm
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose(); // Always close after cancel
  };

  // Ensure onClose is called for the 'alert' type when the primary button is clicked
  const primaryAction = type === 'confirm' && onConfirm ? handleConfirm : onClose;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-slate-800 p-5 sm:p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
        <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-white">{title}</h3>
        <div className="text-sm text-slate-300 mb-5 sm:mb-6 whitespace-pre-wrap">{message}</div>
        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          {type === 'confirm' && (
            <Button variant="secondary" onClick={handleCancel} className="w-full sm:w-auto">
              {cancelText}
            </Button>
          )}
          <Button variant="primary" onClick={primaryAction} className="w-full sm:w-auto">
            {type === 'confirm' && onConfirm ? confirmText : 'OK'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomDialog;
