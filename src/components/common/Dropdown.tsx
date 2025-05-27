import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownProps {
    /** The element that triggers the dropdown (e.g., a button). */
    trigger: React.ReactNode;
    /** The content to display inside the dropdown menu. */
    children: React.ReactNode;
    /** Position of the dropdown menu relative to the trigger. 'left' or 'right'. Defaults to 'right'. */
    position?: 'left' | 'right';
    /** Optional class names for the main dropdown container. */
    className?: string;
    /** Optional class names for the dropdown menu itself. */
    menuClassName?: string;
    /** Callback function when the dropdown opens. */
    onOpen?: () => void;
    /** Callback function when the dropdown closes. */
    onClose?: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({
    trigger,
    children,
    position = 'right',
    className = '',
    menuClassName = '',
    onOpen,
    onClose,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = useCallback(() => {
        setIsOpen(prev => {
            const newState = !prev;
            if (newState && onOpen) {
                onOpen();
            } else if (!newState && onClose) {
                onClose();
            }
            return newState;
        });
    }, [onOpen, onClose]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                if (onClose) {
                    onClose();
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div onClick={toggleDropdown} className="cursor-pointer">
                {trigger}
            </div>

            {isOpen && (
                <div
                    className={`absolute mt-2 w-48 bg-[var(--color-dropdown-bg)] border border-[var(--color-dropdown-border)] rounded-md shadow-lg z-30 overflow-hidden
                        ${position === 'left' ? 'left-0' : 'right-0'}
                        ${menuClassName}
                    `}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

export default Dropdown;
