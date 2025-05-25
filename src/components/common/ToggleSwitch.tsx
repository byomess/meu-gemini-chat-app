import React from 'react';

interface ToggleSwitchProps {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onChange: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    id,
    label,
    description,
    checked,
    onChange,
}) => {
    return (
        <div className="flex items-center justify-between py-2 border-t border-[var(--color-settings-section-border)]">
            <div>
                <label htmlFor={id} className="block text-sm font-medium text-[var(--color-settings-section-title-text)]">
                    {label}
                </label>
                <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">
                    {description}
                </p>
            </div>
            <button
                id={id}
                onClick={onChange}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                    ${checked ? 'bg-[var(--color-toggle-switch-bg-on)]' : 'bg-[var(--color-toggle-switch-bg-off)]'}`}
            >
                <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-toggle-switch-handle-bg)] shadow-lg shadow-[var(--color-toggle-switch-handle-shadow)] ring-0 transition-transform
                        ${checked ? 'translate-x-6' : 'translate-x-1'}`}
                />
            </button>
        </div>
    );
};

export default ToggleSwitch;
