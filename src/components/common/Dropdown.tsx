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
    const timeoutRef = useRef<NodeJS.Timeout | null>(null); // To manage setTimeout for unmounting

    // Effect to manage mounting/unmounting and visibility based on isOpen
    useEffect(() => {
        // Clear any existing timeout to prevent conflicts
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (isOpen) {
            setIsMounted(true); // Mount the component immediately
            // Use requestAnimationFrame to ensure the DOM has updated before applying the 'visible' class
            // This helps trigger the CSS transition correctly.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { // Double rAF for more reliable transition start
                    setIsVisible(true);
                    if (onOpen) onOpen();
                });
            });
        } else {
            setIsVisible(false); // Immediately start fading out
            // Set a timeout to unmount the component after the transition completes
            timeoutRef.current = setTimeout(() => {
                setIsMounted(false); // Unmount the component from DOM
                if (onClose) onClose();
            }, 200); // Match the CSS transition duration (duration-200)
        }

        // Cleanup function for the effect
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

    // Default styling for dropdown items
    const defaultItemClassName = `block w-full text-left px-4 py-2 text-sm
                                  text-[var(--color-dropdown-item-text)]
                                  hover:bg-[var(--color-dropdown-item-hover-bg)]
                                  hover:text-[var(--color-dropdown-item-hover-text)]`.replace(/\s+/g, ' ').trim();

    // Clone children to apply default item styling
    const renderChildrenWithDefaultStyles = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
            const existingClassName = child.props.className || '';
            const newClassName = `${defaultItemClassName} ${existingClassName}`.trim();
            return React.cloneElement(child, { className: newClassName });
        }
        return child;
    });

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div onClick={toggleDropdown} className="cursor-pointer">
                {trigger}
            </div>

            {isMounted && ( // Render only when mounted
                <div
                    className={`absolute mt-2 bg-[var(--color-dropdown-bg)] border border-[var(--color-dropdown-border)] rounded-md shadow-lg z-30 overflow-hidden
                        ${position === 'left' ? 'left-0' : 'right-0'}
                        ${menuClassName}
                        transition-opacity transition-transform duration-200 ease-out
                        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
                    `}
                >
                    {renderChildrenWithDefaultStyles}
                </div>
            )}
        </div>
    );
};

export default Dropdown;
