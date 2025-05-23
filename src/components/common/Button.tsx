// src/components/common/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'ghost'; // Added 'ghost' variant
    size?: 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md'; // Added 'icon-sm' and 'icon-md' sizes
    isActive?: boolean; // Added isActive prop
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant = 'primary', size = 'md', className, isActive = false, ...props }, ref) => {
        const baseStyles =
            'inline-flex items-center justify-center font-medium focus:outline-none disabled:opacity-60 disabled:pointer-events-none transition-all duration-150 ease-in-out cursor-pointer'; // Added cursor-pointer

        const sizeStyles = {
            sm: 'px-3 py-1.5 text-xs rounded',
            md: 'px-4 py-2 text-sm rounded-md',
            lg: 'px-6 py-3 text-base rounded-lg',
            'icon-sm': 'p-1.5 rounded-md', // For small icon buttons with square-ish shape
            'icon-md': 'p-2 rounded-full', // For larger icon buttons with circular shape
        };

        const variantStyles = {
            primary:
                `bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] hover:bg-[var(--color-button-primary-hover-bg)] active:bg-[var(--color-button-primary-active-bg)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)] shadow-sm hover:shadow-md`, // Removed active:scale-[0.98]
            secondary:
                `bg-[var(--color-button-secondary-bg)] text-[var(--color-button-secondary-text)] hover:bg-[var(--color-button-secondary-hover-bg)] active:bg-[var(--color-button-secondary-active-bg)] focus:ring-2 focus:ring-[var(--color-button-focus-ring-secondary)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)] shadow-sm hover:shadow-md border border-[var(--color-button-secondary-border)]`,
            danger:
                `bg-[var(--color-button-danger-bg)] text-[var(--color-button-danger-text)] hover:bg-[var(--color-button-danger-hover-bg)] active:bg-[var(--color-button-danger-active-bg)] focus:ring-2 focus:ring-[var(--color-red-500)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)] shadow-sm hover:shadow-md`,
            icon:
                `${isActive ? 'text-[var(--color-button-icon-active-text)]' : 'text-[var(--color-button-icon-text)]'} hover:text-[var(--color-button-icon-hover-text)] hover:bg-[var(--color-button-icon-hover-bg)] active:bg-[var(--color-button-icon-active-bg)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-1 focus:ring-offset-[var(--color-focus-ring-offset)]`, // Conditional text color based on isActive
            ghost:
                `text-[var(--color-button-ghost-text)] hover:bg-[var(--color-button-ghost-hover-bg)] active:bg-[var(--color-button-ghost-active-bg)] focus:ring-2 focus:ring-[var(--color-gray-300)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]`, // New minimal variant
        };

        return (
            <button
                ref={ref}
                type="button"
                className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className || ''}`}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
