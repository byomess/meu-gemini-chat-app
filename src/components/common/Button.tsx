// src/components/common/Button.tsx
import React from 'react';
import clsx from 'clsx'; // Make sure to install clsx: npm install clsx or yarn add clsx

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md';
    isActive?: boolean;
}

// Base styles applied to all buttons
const baseStyles =
    'inline-flex items-center justify-center font-medium focus:outline-none disabled:opacity-60 disabled:pointer-events-none transition-all duration-150 ease-in-out cursor-pointer';

// Size-specific styles
const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs rounded',
    md: 'px-4 py-2 text-sm rounded-md',
    lg: 'px-6 py-3 text-base rounded-lg',
    'icon-sm': 'p-1.5 rounded-md', // For small icon buttons with square-ish shape
    'icon-md': 'p-2 rounded-full', // For larger icon buttons with circular shape
};

// Common focus and shadow styles for most variants
const commonFocusShadowStyles =
    'focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)] shadow-sm hover:shadow-md';

// Variant-specific styles function
const getVariantStyles = (variant: ButtonProps['variant'], isActive: boolean) => {
    switch (variant) {
        case 'primary':
            return clsx(
                `bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)]`,
                `hover:bg-[var(--color-button-primary-hover-bg)] active:bg-[var(--color-button-primary-active-bg)]`,
                `focus:ring-[var(--color-focus-ring)]`,
                commonFocusShadowStyles
            );
        case 'secondary':
            return clsx(
                `bg-[var(--color-button-secondary-bg)] text-[var(--color-button-secondary-text)]`,
                `hover:bg-[var(--color-button-secondary-hover-bg)] active:bg-[var(--color-button-secondary-active-bg)]`,
                `focus:ring-[var(--color-button-focus-ring-secondary)]`,
                `border border-[var(--color-button-secondary-border)]`,
                commonFocusShadowStyles
            );
        case 'danger':
            return clsx(
                `bg-[var(--color-button-danger-bg)] text-[var(--color-button-danger-text)]`,
                `hover:bg-[var(--color-button-danger-hover-bg)] active:bg-[var(--color-button-danger-active-bg)]`,
                `focus:ring-[var(--color-red-500)]`,
                commonFocusShadowStyles
            );
        case 'icon':
            return clsx(
                isActive ? 'text-[var(--color-button-icon-active-text)]' : 'text-[var(--color-button-icon-text)]',
                `hover:text-[var(--color-button-icon-hover-text)] hover:bg-[var(--color-button-icon-hover-bg)]`,
                `active:bg-[var(--color-button-icon-active-bg)]`,
                `focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-1 focus:ring-offset-[var(--color-focus-ring-offset)]`
            );
        case 'ghost':
            return clsx(
                `text-[var(--color-button-ghost-text)]`,
                `hover:bg-[var(--color-button-ghost-hover-bg)] active:bg-[var(--color-button-ghost-active-bg)]`,
                `focus:ring-2 focus:ring-[var(--color-gray-300)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]`
            );
        default:
            return '';
    }
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant = 'primary', size = 'md', className, isActive = false, type = 'button', ...props }, ref) => {
        const buttonClasses = clsx(
            baseStyles,
            sizeStyles[size],
            getVariantStyles(variant, isActive),
            className
        );

        return (
            <button
                ref={ref}
                type={type} // Use the type prop, defaulting to 'button'
                className={buttonClasses}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
