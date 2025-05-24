// src/components/common/CustomDialog.tsx
import React, { Fragment, useRef, useEffect, useCallback } from 'react';
import Button from './Button';
import { Transition } from '@headlessui/react';

// CustomDialogProps permanece o mesmo
export interface CustomDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  onClose: () => void;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  onCancel?: () => void;
  type?: 'alert' | 'confirm';
}

const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  title,
  message,
  onClose,
  confirmText = 'OK',
  onConfirm,
  cancelText = 'Cancelar',
  onCancel,
  type = 'alert',
}) => {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const dialogPanelRef = useRef<HTMLDivElement>(null);

  const handleConfirm = useCallback(() => {
    if (onConfirm) onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  const handleCancel = useCallback(() => {
    if (onCancel) onCancel();
    onClose();
  }, [onCancel, onClose]);

  const handlePrimaryAction = useCallback(() => {
    if (type === 'confirm' && onConfirm) {
      handleConfirm();
    } else {
      onClose();
    }
  }, [type, onConfirm, handleConfirm, onClose]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        if (type === 'confirm') {
          handleCancel();
        } else {
          onClose();
        }
      }
    },
    [type, handleCancel, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const giveFocusToPrimaryButton = () => {
        primaryButtonRef.current?.focus();
    }
    const timer = setTimeout(giveFocusToPrimaryButton, 100);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (type === 'confirm') {
          handleCancel();
        } else {
          onClose();
        }
        return;
      }
      if (event.key === 'Tab' && dialogPanelRef.current) {
        const focusableElements = Array.from(
          dialogPanelRef.current.querySelectorAll(
            'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => dialogPanelRef.current?.contains(el)) as HTMLElement[];

        if (focusableElements.length === 0) return;
        const firstFocusableEl = focusableElements[0];
        const lastFocusableEl = focusableElements[focusableElements.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === firstFocusableEl) {
            lastFocusableEl.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusableEl) {
            firstFocusableEl.focus();
            event.preventDefault();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [isOpen, type, handleCancel, onClose]);

  // O Transition principal controla a montagem/desmontagem e animações.
  // Não precisamos do if (!isOpen) return null; aqui se a Transition lida com 'show'.
  return (
    <Transition appear show={isOpen} as={Fragment}>
      {/* Este div será o container do diálogo DENTRO do portal.
          Ele precisa ser 'fixed' para cobrir a tela e ter um z-index alto. */}
      <div
        className="fixed inset-0 z-[5000] flex items-center justify-center p-4" // z-index ainda alto, mas relativo ao body.
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-dialog-portal-title"
        aria-describedby="custom-dialog-portal-description"
      >
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="absolute inset-0 bg-[var(--color-dialog-overlay-bg)] backdrop-blur-sm"
            onClick={handleOverlayClick}
          />
        </Transition.Child>

        {/* Dialog Panel */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div
            ref={dialogPanelRef}
            className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-[var(--color-dialog-bg)] p-5 sm:p-6 text-left align-middle shadow-xl border border-[var(--color-dialog-border)]"
          >
            <h3
              id="custom-dialog-portal-title"
              className="text-lg sm:text-xl font-semibold leading-6 text-[var(--color-dialog-title-text)] mb-3 sm:mb-4"
            >
              {title}
            </h3>
            <div
              id="custom-dialog-portal-description"
              className="mb-5 sm:mb-6"
            >
              <div className="text-sm text-[var(--color-dialog-message-text)] whitespace-pre-wrap">
                {message}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
              <Button
                variant="primary"
                onClick={handlePrimaryAction}
                className="w-full sm:w-auto"
                ref={primaryButtonRef}
              >
                {type === 'confirm' && onConfirm ? confirmText : 'OK'}
              </Button>
              {type === 'confirm' && (
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  className="w-full sm:w-auto"
                >
                  {cancelText}
                </Button>
              )}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default CustomDialog;