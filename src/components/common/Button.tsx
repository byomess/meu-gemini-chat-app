// src/components/common/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'ghost'; // Added 'ghost' variant
  size?: 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md'; // Added 'icon-sm' and 'icon-md' sizes
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className, ...props }) => {
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
      `bg-[#e04579] text-white hover:bg-[#c73d6a] active:bg-[#b3365f] focus:ring-2 focus:ring-[#e04579] focus:ring-offset-2 focus:ring-offset-white shadow-sm hover:shadow-md`,
    secondary:
      `bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-white shadow-sm hover:shadow-md border border-gray-300`,
    danger:
      `bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white shadow-sm hover:shadow-md`,
    icon:
      `text-gray-600 hover:text-[#e04579] hover:bg-pink-100 active:bg-pink-200 focus:ring-2 focus:ring-[#e04579] focus:ring-offset-1 focus:ring-offset-white`, // Removed default padding and border-radius, now handled by 'size'
    ghost:
      `text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-white`, // New minimal variant
  };

  return (
    <button
      type="button"
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
