import React from 'react';

interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** The content of the dropdown item (e.g., text). */
    children: React.ReactNode;
    /** Optional icon to display before the text. */
    icon?: React.ReactNode;
}

const DropdownItem: React.FC<DropdownItemProps> = ({
    children,
    icon,
    className = '', // Allow custom classes to be passed and merged
    ...props
}) => {
    // Default styling for dropdown items
    const baseClasses = `block w-full text-left px-4 py-2 text-sm
                         text-[var(--color-dropdown-item-text)]
                         hover:bg-[var(--color-dropdown-item-hover-bg)]
                         hover:text-[var(--color-dropdown-item-hover-text)]
                         flex items-center`.replace(/\s+/g, ' ').trim();

    return (
        <button
            type="button" // Ensure it's a button type to prevent form submission
            className={`${baseClasses} ${className}`}
            {...props}
        >
            {icon && <span className="mr-2">{icon}</span>}
            {children}
        </button>
    );
};

export default DropdownItem;
