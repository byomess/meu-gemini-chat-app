import React from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import Tooltip from './Tooltip';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean; // Optional: to disable specific options
}

interface SelectInputProps {
    id: string;
    name: string;
    label?: string | React.ReactNode;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string; // For the default/first option if needed
    disabled?: boolean;
    helperText?: React.ReactNode;
    tooltipContent?: React.ReactNode;

    // Styling props
    className?: string; // Applies to the root div
    labelClassName?: string;
    selectClassName?: string; // Custom classes for the select element itself
}

const SelectInput: React.FC<SelectInputProps> = ({
    id,
    name,
    label,
    value,
    onChange,
    options,
    placeholder,
    disabled = false,
    helperText,
    tooltipContent,
    className = '',
    labelClassName = "block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1.5",
    selectClassName = '',
}) => {
    // Base styles aligned with TextInput
    const baseSelectClasses = `
        block w-full p-3 shadow-sm transition-colors duration-200
        bg-[var(--color-text-input-bg)]
        border border-[var(--color-text-input-border)]
        rounded-xl
        text-[var(--color-text-input-text)]
        placeholder-[var(--color-text-input-placeholder-text)]
        focus:ring-2 focus:ring-[var(--color-text-input-focus-ring)]
        focus:border-[var(--color-text-input-focus-border)]
        focus:outline-none
        appearance-none cursor-pointer
    `.replace(/\s+/g, ' ').trim(); // Clean up whitespace

    return (
        <div className={className}>
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
            <div className="relative"> {/* Wrapper for custom arrow */}
                <select
                    id={id}
                    name={name}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={`${baseSelectClasses} ${selectClassName}`}
                >
                    {placeholder && <option value="" disabled>{placeholder}</option>}
                    {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {/* Custom arrow icon for consistent appearance across browsers */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-input-icon)]">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
            {helperText && (
                <div className="mt-1.5 text-xs text-[var(--color-text-input-helper-text)]">
                    {helperText}
                </div>
            )}
        </div>
    );
};

export default SelectInput;
