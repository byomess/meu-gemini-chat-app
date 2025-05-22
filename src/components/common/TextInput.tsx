// src/components/common/TextInput.tsx
import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi'; // Assuming react-icons is installed

interface TextInputProps {
    id: string;
    name: string;
    label: string;
    value: string;
    onChange: (value: string) => void; // Passes the string value directly
    type?: 'text' | 'password' | 'email' | 'url' | 'number';
    placeholder?: string;
    helperText?: string | React.ReactNode;
    disabled?: boolean;
    autoComplete?: string;

    // Styling props
    containerClassName?: string;
    labelClassName?: string;
    inputWrapperClassName?: string;
    inputClassName?: string; // Custom classes for the input element
    helperTextClassName?: string;
}

const TextInput: React.FC<TextInputProps> = ({
    id,
    name,
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    helperText,
    disabled = false,
    autoComplete,
    containerClassName = '', // Default: no extra classes for the main container
    labelClassName = "block text-sm font-medium text-gray-700 mb-1.5",
    inputWrapperClassName = "relative", // For the div wrapping input and icon
    inputClassName: customInputClassName = "", // User-provided custom classes for input
    helperTextClassName = "text-xs text-gray-500 mt-2",
}) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const actualInputType = type === 'password' && isPasswordVisible ? 'text' : type;

    // Base styles matching the original input in GeneralSettingsTab
    const baseInputClasses = "w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e04579] focus:border-[#e04579] placeholder-gray-400 text-gray-800 shadow-sm transition-colors";
    
    // Add padding to the right if it's a password input to make space for the icon
    const passwordSpecificClasses = type === 'password' ? "pr-12" : ""; // Adjust pr-X as needed for icon spacing

    const effectiveInputClassName = `${baseInputClasses} ${passwordSpecificClasses} ${customInputClassName}`.trim();

    return (
        <div className={containerClassName}>
            <label htmlFor={id} className={labelClassName}>
                {label}
            </label>
            <div className={inputWrapperClassName}>
                <input
                    type={actualInputType}
                    id={id}
                    name={name}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    className={effectiveInputClassName}
                />
                {type === 'password' && (
                    <button
                        type="button"
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e04579] rounded-r-lg"
                        aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    >
                        {isPasswordVisible ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                )}
            </div>
            {helperText && (
                <p className={helperTextClassName}>
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default TextInput;
