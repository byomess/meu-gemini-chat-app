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

    const openDropdown = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current); // Clear any pending close timeout
        setIsMounted(true); // Mount the component
        // Allow a tiny delay for the DOM to update with initial hidden state
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true); // Start the fade-in transition
            if (onOpen) onOpen();
        }, 10); // Small delay to ensure CSS transition applies
    }, [onOpen]);

    const closeDropdown = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current); // Clear any pending open timeout
        setIsVisible(false); // Start the fade-out transition
        // Wait for the transition to complete before unmounting
        timeoutRef.current = setTimeout(() => {
            setIsMounted(false); // Unmount the component from DOM
            if (onClose) onClose();
        }, 200); // Match the CSS transition duration (duration-200)
    }, [onClose]);

    const toggleDropdown = useCallback(() => {
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
        setIsOpen(prev => !prev); // Toggle the logical state
    }, [isOpen, openDropdown, closeDropdown]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                if (isOpen) { // Only attempt to close if it's logically open
                    closeDropdown();
                    setIsOpen(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (timeoutRef.current) { // Clean up timeout on effect cleanup
                clearTimeout(timeoutRef.current);
            }
        };
    }, [isOpen, closeDropdown]); // Depend on isOpen to re-evaluate click outside logic

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
