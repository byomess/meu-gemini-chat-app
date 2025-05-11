import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiPaperclip } from 'react-icons/fi';
import { IoImagesOutline, IoDocumentAttachOutline, IoCameraOutline
 } from 'react-icons/io5';

export type AttachmentOption = 'photos' | 'files' | 'camera';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AttachmentButtonProps {
  // onSelectOption: (option: AttachmentOption) => void; // Vamos implementar isso na próxima etapa
  // Por enquanto, apenas para UI e console.log interno
}

const AttachmentButton: React.FC<AttachmentButtonProps> = (/*{ onSelectOption }*/) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggleTooltip = useCallback(() => {
    setIsTooltipOpen(prev => !prev);
  }, []);

  const handleOptionClick = useCallback((option: AttachmentOption) => {
    console.log(`Attachment option selected: ${option}`);
    // onSelectOption(option); // Será ativado quando integrarmos
    setIsTooltipOpen(false);
  }, [/*onSelectOption*/]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isTooltipOpen &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsTooltipOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTooltipOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleTooltip}
        type="button"
        className="p-2 text-gray-600 rounded-md hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
        aria-label="Attach file"
        title="Attach file"
      >
        <FiPaperclip size={22} />
      </button>

      {isTooltipOpen && (
        <div
          ref={tooltipRef}
          className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-xl z-20 py-1"
        >
          <ul>
            <li
              className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => handleOptionClick('photos')}
            >
              <IoImagesOutline size={18} className="mr-3 text-gray-500 dark:text-gray-400" />
              Fotos
            </li>
            <li
              className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => handleOptionClick('files')}
            >
              <IoDocumentAttachOutline size={18} className="mr-3 text-gray-500 dark:text-gray-400" />
              Arquivos
            </li>
            <li
              className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => handleOptionClick('camera')}
            >
              <IoCameraOutline size={18} className="mr-3 text-gray-500 dark:text-gray-400" />
              Câmera
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default AttachmentButton;
