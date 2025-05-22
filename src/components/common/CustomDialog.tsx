// src/components/common/CustomDialog.tsx
import React, { Fragment, useRef, useEffect, useCallback } from 'react';
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
  cancelText = 'Cancelar',
  onCancel,
  type = 'alert',
}) => {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null); // Ref for the dialog content

  // Memoize handleConfirm and handleCancel to ensure stable references
  const handleConfirm = useCallback(() => {
    if (onConfirm) onConfirm();
    onClose(); // Always close after confirm
  }, [onConfirm, onClose]);

  const handleCancel = useCallback(() => {
    if (onCancel) onCancel();
    onClose(); // Always close after cancel
  }, [onCancel, onClose]);

  // This function handles the primary action (OK/Confirm) and stops propagation
  const primaryAction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Stop event propagation for the button click
    if (type === 'confirm' && onConfirm) {
      handleConfirm();
    } else {
      onClose(); // Call onClose directly for alert type
    }
  }, [type, onConfirm, handleConfirm, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Focus the primary button when the dialog opens
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 100); // A small delay, adjust if needed

      // Add event listener for Escape key and Tab key for focus trapping
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (type === 'confirm') {
            handleCancel(); // Call cancel logic for confirm type
          } else {
            onClose(); // Just close for alert type
          }
        } else if (event.key === 'Tab' && dialogContentRef.current) {
          const focusableElements = Array.from(
            dialogContentRef.current.querySelectorAll(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ) as HTMLElement[];

          if (focusableElements.length === 0) return; // No focusable elements to trap

          const firstFocusableEl = focusableElements[0];
          const lastFocusableEl = focusableElements[focusableElements.length - 1];

          if (event.shiftKey) { // Shift + Tab
            if (document.activeElement === firstFocusableEl) {
              lastFocusableEl.focus();
              event.preventDefault();
            }
          } else { // Tab
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
  }, [isOpen, type, handleCancel, onClose]); // Dependencies for the useEffect

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <div className="relative z-[200]">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          {/* Very light transparent black background with blur */}
          <div
            className="fixed inset-0 bg-[var(--color-dialog-overlay-bg)] backdrop-blur-sm"
            onClick={type === 'confirm' ? handleCancel : onClose} // Handle click outside
          />
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
              {/* White dialog panel with gray border and dark text */}
              <div
                className="w-full max-w-md transform overflow-hidden rounded-xl bg-[var(--color-dialog-bg)] p-5 sm:p-6 text-left align-middle shadow-xl transition-all border border-[var(--color-dialog-border)]"
                ref={dialogContentRef} // Assign the ref here
                role="dialog" // ARIA role for accessibility
                aria-modal="true" // ARIA attribute for modal dialogs
                aria-labelledby="dialog-title" // Link to the title for screen readers
                aria-describedby="dialog-description" // Link to the message for screen readers
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
                    ref={primaryButtonRef} // Assign the ref here
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
      </div>
    </Transition>
  );
};

export default CustomDialog;
