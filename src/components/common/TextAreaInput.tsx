import React from 'react';

interface TextAreaInputProps {
    id: string;
    name: string;
    label?: string | React.ReactNode;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    rows?: number; // Number of rows for the textarea
    helperText?: string | React.ReactNode;
    inputClassName?: string; // For custom styling of the textarea itself
    containerClassName?: string; // For custom styling of the outer div
}

const TextAreaInput: React.FC<TextAreaInputProps> = ({
    id,
    name,
    label,
    value,
    onChange,
    placeholder,
    disabled = false,
    rows = 4, // Default rows
    helperText,
    inputClassName = '',
    containerClassName = '',
}) => {
    return (
        <div className={`flex flex-col ${containerClassName}`}>
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-input-label-text)] mb-1">
                    {label}
                </label>
            )}
            <textarea
                id={id}
                name={name}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                // Removed 'border-0' to allow inputClassName's border to apply correctly.
                // Removed 'sm:text-sm sm:leading-6' to use a larger, more standard font size.
                className={`block w-full rounded-md py-1.5 bg-[var(--color-input-form-bg)] text-[var(--color-input-text)] shadow-sm ring-1 ring-inset ring-[var(--color-input-border)] placeholder:text-[var(--color-input-placeholder)] focus:ring-2 focus:ring-inset focus:ring-[var(--color-input-focus-ring)] transition-colors duration-200 ${inputClassName}`}
            />
            {helperText && (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default TextAreaInput;
