import React, { useState, forwardRef } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi'; // Assuming react-icons is installed
import { IoInformationCircleOutline } from 'react-icons/io5'; // Import info icon
import Tooltip from './Tooltip'; // Import Tooltip component

interface TextInputProps {
    id: string;
    name: string;
    label?: string | React.ReactNode; // Re-added label prop
    value: string;
    onChange: (value: string) => void; // Passes the string value directly
    type?: 'text' | 'password' | 'email' | 'url' | 'number';
    placeholder?: string;
    disabled?: boolean;
    autoComplete?: string;
    tooltipContent?: React.ReactNode; // New prop for tooltip content
    helperText?: React.ReactNode; // New prop for helper text

    // Styling props
    className?: string; // Renamed from Name, applies to the root div
    labelClassName?: string; // Re-added labelClassName prop
    inputWrapperClassName?: string; // For the div wrapping input and icon
    inputClassName?: string; // Custom classes for the input element itself
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(({
    id,
    name,
    label, // Re-added
    value,
    onChange,
    type = 'text',
    placeholder,
    disabled = false,
    autoComplete,
    tooltipContent, // New prop
    helperText, // New prop
    className = '', // Renamed from containerClassName, default empty
    labelClassName = "block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1.5", // Re-added
    inputWrapperClassName = "relative", // For the div wrapping input and icon
    inputClassName: customInputClassName = "", // User-provided custom classes for input
}, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const actualInputType = type === 'password' && isPasswordVisible ? 'text' : type;

    // Base styles matching the original input in GeneralSettingsTab
    const baseInputClasses = "w-full p-3 bg-[var(--color-text-input-bg)] border border-[var(--color-text-input-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)] focus:border-[var(--color-text-input-focus-border)] placeholder-[var(--color-text-input-placeholder-text)] text-[var(--color-text-input-text)] shadow-sm transition-colors";
    
    const passwordSpecificClasses = type === 'password' ? "pr-12" : ""; // Adjust pr-X as needed for icon spacing

    const effectiveInputClassName = `${baseInputClasses} ${passwordSpecificClasses} ${customInputClassName}`.trim();

    return (
        <div className={className}> {/* Apply the main className prop here */}
            {label && (
                <div className="flex items-center mb-1.5">
                    {tooltipContent && (
                        <Tooltip content={tooltipContent}>
                            <IoInformationCircleOutline size={18} className="text-[var(--color-text-input-label-icon)] mr-2" />
                        </Tooltip>
                    )}
                    <label htmlFor={id} className={labelClassName}>
                        {label}
                    </label>
                </div>
            )}
            {/* Ensure the wrapper div also takes full width if it's a flex item or needs to contain a w-full input */}
            <div className={`${inputWrapperClassName} w-full`}> {/* Added w-full here */}
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
            {helperText && (
                <div className="mt-1.5 text-xs text-[var(--color-text-input-helper-text)]">
                    {helperText}
                </div>
            )}
        </div>
    );
});

TextInput.displayName = 'TextInput';

export default TextInput;
