import React from 'react';

interface RangeInputProps {
    id: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
    helperText: string;
    disabled?: boolean;
}

const RangeInput: React.FC<RangeInputProps> = ({
    id,
    label,
    min,
    max,
    step,
    value,
    onChange,
    helperText,
    disabled = false,
}) => {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] mb-1.5">
                {label}: <span className={`font-semibold ${disabled ? 'text-[var(--color-range-slider-value-text-disabled)]' : 'text-[var(--color-model-settings-range-value-text)]'}`}>{value}</span>
            </label>
            <input
                type="range"
                id={id}
                name={id}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                disabled={disabled}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer
                    ${disabled ? 'bg-[var(--color-range-slider-track-bg-disabled)]' : 'bg-[var(--color-model-settings-range-input-bg)]'}
                    [&::-webkit-slider-runnable-track]:rounded-lg
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:shadow-md
                    ${disabled
                        ? '[&::-webkit-slider-thumb]:bg-[var(--color-range-slider-thumb-bg-disabled)] [&::-webkit-slider-thumb]:border-[var(--color-range-slider-thumb-border-disabled)]'
                        : '[&::-webkit-slider-thumb]:bg-[var(--color-model-settings-range-input-thumb)] [&::-webkit-slider-thumb]:border-[var(--color-model-settings-range-input-thumb-border)]'
                    }
                    ${disabled
                        ? '[&::-webkit-slider-runnable-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-webkit-slider-runnable-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                `}
            />
            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">{helperText}</p>
        </div>
    );
};

export default RangeInput;
