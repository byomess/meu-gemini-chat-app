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
                // Added px-3 for horizontal padding
                // Added default border and focus:border using generic input variables
                // Added focus:outline-none to remove default browser outline
                className={`block w-full rounded-md py-1.5 px-3 shadow-sm transition-colors duration-200
                    bg-[var(--color-input-form-bg)]
                    border border-[var(--color-text-input-border)]
                    text-[var(--color-input-text)]
                    placeholder:text-[var(--color-input-placeholder)]
                    focus:border-[var(--color-text-input-focus-border)]
                    focus:outline-none
                    ${inputClassName}
                `}
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
