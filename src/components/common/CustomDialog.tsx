import React, { Fragment, useRef, useEffect, useCallback } from 'react';
import Button from './Button';
import { Transition } from '@headlessui/react';

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
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const handleConfirm = useCallback(() => {
    if (onConfirm) onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  const handleCancel = useCallback(() => {
    if (onCancel) onCancel();
    onClose();
  }, [onCancel, onClose]);

  const primaryAction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === 'confirm' && onConfirm) {
      handleConfirm();
    } else {
      onClose();
    }
  }, [type, onConfirm, handleConfirm, onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 100);

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (type === 'confirm') {
            handleCancel();
          } else {
            onClose();
          }
        } else if (event.key === 'Tab' && dialogContentRef.current) {
          const focusableElements = Array.from(
            dialogContentRef.current.querySelectorAll(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ) as HTMLElement[];

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

      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, type, handleCancel, onClose]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <div className="relative z-[200]">
        {/* New container for both overlay and dialog content */}
        <div className="fixed inset-0 overflow-y-auto flex min-h-full items-center justify-center p-4 text-center">
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
              onClick={type === 'confirm' ? handleCancel : onClose}
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
              className="relative z-10 w-full max-w-md transform overflow-hidden rounded-xl bg-[var(--color-dialog-bg)] p-5 sm:p-6 text-left align-middle shadow-xl transition-all border border-[var(--color-dialog-border)]"
              ref={dialogContentRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              aria-describedby="dialog-description"
            >
              <h3 id="dialog-title" className="text-lg sm:text-xl font-semibold leading-6 text-[var(--color-dialog-title-text)] mb-3 sm:mb-4">
                {title}
              </h3>
              <div id="dialog-description" className="mb-5 sm:mb-6">
                <div className="text-sm text-[var(--color-dialog-message-text)] whitespace-pre-wrap">
                  {message}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
                <Button
                  variant="primary"
                  onClick={primaryAction}
                  className="w-full sm:w-auto"
                  ref={primaryButtonRef}
                >
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
    </Transition>
  );
};

export default CustomDialog;
