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
    const [isOpen, setIsOpen] = useState(false); // Logical state: should it be open?
    const [isMounted, setIsMounted] = useState(false); // Controls DOM presence for transitions
    const [isVisible, setIsVisible] = useState(false); // Controls visual opacity/transform

    const dropdownRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null); // To manage transition timeouts

    // Effect to manage mounting/unmounting and visibility based on isOpen
    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (isOpen) {
            setIsMounted(true); // Mount the component
            timeoutRef.current = setTimeout(() => {
                setIsVisible(true); // Start the fade-in transition
                if (onOpen) onOpen();
            }, 10); // Small delay to ensure CSS transition applies
        } else {
            setIsVisible(false); // Start the fade-out transition
            timeoutRef.current = setTimeout(() => {
                setIsMounted(false); // Unmount the component from DOM
                if (onClose) onClose();
            }, 200); // Match the CSS transition duration (duration-200)
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [isOpen, onOpen, onClose]); // Re-run when isOpen changes

    const toggleDropdown = useCallback(() => {
        setIsOpen(prev => !prev); // Simply toggle the logical state
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false); // Set logical state to false
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []); // No dependencies needed here, as setIsOpen is stable

    // Cleanup timeout on component unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div onClick={toggleDropdown} className="cursor-pointer">
                {trigger}
            </div>

            {isMounted && ( // Render only when mounted
                <div
                    className={`absolute mt-2 w-48 bg-[var(--color-dropdown-bg)] border border-[var(--color-dropdown-border)] rounded-md shadow-lg z-30 overflow-hidden
                        ${position === 'left' ? 'left-0' : 'right-0'}
                        ${menuClassName}
                        transition-opacity transition-transform duration-200 ease-out
                        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
                    `}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

export default Dropdown;
