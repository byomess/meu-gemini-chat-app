import React, { useState, forwardRef } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi'; // Assuming react-icons is installed

interface TextInputProps {
    id: string;
    name: string;
    // label?: string | React.ReactNode; // Removed label prop
    value: string;
    onChange: (value: string) => void; // Passes the string value directly
    type?: 'text' | 'password' | 'email' | 'url' | 'number';
    placeholder?: string;
    // helperText?: string | React.ReactNode; // Removed helperText prop
    disabled?: boolean;
    autoComplete?: string;

    // Styling props
    containerClassName?: string;
    // labelClassName?: string; // Removed labelClassName prop
    inputWrapperClassName?: string;
    inputClassName?: string; // Custom classes for the input element
    // helperTextClassName?: string; // Removed helperTextClassName prop
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(({
    id,
    name,
    // label, // Removed
    value,
    onChange,
    type = 'text',
    placeholder,
    // helperText, // Removed
    disabled = false,
    autoComplete,
    containerClassName = '', // Default: no extra classes for the main container
    // labelClassName = "block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1.5", // Removed
    inputWrapperClassName = "relative", // For the div wrapping input and icon
    inputClassName: customInputClassName = "", // User-provided custom classes for input
    // helperTextClassName = "text-xs text-[var(--color-text-input-helper-text)] mt-2", // Removed
}, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const actualInputType = type === 'password' && isPasswordVisible ? 'text' : type;

    // Base styles matching the original input in GeneralSettingsTab
    const baseInputClasses = "w-full p-3 bg-[var(--color-text-input-bg)] border border-[var(--color-text-input-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-text-input-focus-border)] placeholder-[var(--color-text-input-placeholder-text)] text-[var(--color-text-input-text)] shadow-sm transition-colors";
    
    const passwordSpecificClasses = type === 'password' ? "pr-12" : ""; // Adjust pr-X as needed for icon spacing

    const effectiveInputClassName = `${baseInputClasses} ${passwordSpecificClasses} ${customInputClassName}`.trim();

    return (
        <div className={containerClassName}>
            {/* Label rendering moved to parent component */}
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
                    ref={ref}
                />
                {type === 'password' && (
                    <button
                        type="button"
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-[var(--color-text-input-icon)] hover:text-[var(--color-text-input-icon-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] rounded-r-xl"
                        aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    >
                        {isPasswordVisible ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                )}
            </div>
            {/* HelperText rendering removed as per previous instructions */}
        </div>
    );
});

TextInput.displayName = 'TextInput';

export default TextInput;
