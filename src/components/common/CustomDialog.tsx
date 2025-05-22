// src/components/common/CustomDialog.tsx
import React, { Fragment } from 'react';
import { Transition } from '@headlessui/react';
import Button from './Button';

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
  cancelText = 'Cancelar', // Changed default to Portuguese to match app context
  onCancel,
  type = 'alert',
}) => {
  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose(); // Always close after confirm
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose(); // Always close after cancel
  };

  const primaryAction = type === 'confirm' && onConfirm ? handleConfirm : onClose;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <div className="relative z-[200]"> {/* Changed from Dialog to div for Headless UI Transition context */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="w-full max-w-md transform overflow-hidden rounded-xl bg-slate-800 p-5 sm:p-6 text-left align-middle shadow-xl transition-all border border-slate-700">
                <h3 className="text-lg sm:text-xl font-semibold leading-6 text-white mb-3 sm:mb-4">
                  {title}
                </h3>
                <div className="mb-5 sm:mb-6">
                  <div className="text-sm text-slate-300 whitespace-pre-wrap">
                    {message}
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
                  <Button variant="primary" onClick={primaryAction} className="w-full sm:w-auto">
                    {type === 'confirm' && onConfirm ? confirmText : 'OK'}
                  </Button>
                  {type === 'confirm' && (
                    <Button variant="secondary" onClick={handleCancel} className="w-full sm:w-auto">
                      {cancelText}
                    </Button>
                  )}
                </div>
              </div>
            </Transition.Child>
          </div>
        </div>
      </div>
    </Transition>
  );
};

export default CustomDialog;
