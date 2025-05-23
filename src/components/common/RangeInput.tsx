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
                className={`w-full h-0.5 rounded-lg appearance-none cursor-pointer
                    ${disabled ? 'bg-[var(--color-range-slider-track-bg-disabled)]' : 'bg-[var(--color-model-settings-range-input-bg)]'}
                    {/* Webkit Track */}
                    [&::-webkit-slider-runnable-track]:h-0.5 /* Explicitly set track height */
                    [&::-webkit-slider-runnable-track]:rounded-lg
                    {/* Webkit Thumb */}
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:h-5 /* Increased size */
                    [&::-webkit-slider-thumb]:w-5 /* Increased size */
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:border-2 /* Added border width */
                    [&::-webkit-slider-thumb]:shadow-lg /* Enhanced shadow */
                    [&::-webkit-slider-thumb]:mt-[-9px] /* Vertically center thumb on track */
                    ${disabled /* Webkit Thumb Colors */
                        ? '[&::-webkit-slider-thumb]:bg-[var(--color-range-slider-thumb-bg-disabled)] [&::-webkit-slider-thumb]:border-[var(--color-range-slider-thumb-border-disabled)]'
                        : '[&::-webkit-slider-thumb]:bg-[var(--color-model-settings-range-input-thumb)] [&::-webkit-slider-thumb]:border-[var(--color-model-settings-range-input-thumb-border)]'
                    }
                    {/* Mozilla Thumb */}
                    [&::-moz-range-thumb]:appearance-none
                    [&::-moz-range-thumb]:h-5 /* Consistent size */
                    [&::-moz-range-thumb]:w-5 /* Consistent size */
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:border-2 /* Consistent border width */
                    [&::-moz-range-thumb]:shadow-lg /* Consistent shadow */
                    [&::-moz-range-thumb]:mt-[-9px] /* Vertically center thumb on track */
                    ${disabled /* Mozilla Thumb Colors */
                        ? '[&::-moz-range-thumb]:bg-[var(--color-range-slider-thumb-bg-disabled)] [&::-::-moz-range-thumb]:border-[var(--color-range-slider-thumb-border-disabled)]'
                        : '[&::-moz-range-thumb]:bg-[var(--color-model-settings-range-input-thumb)] [&::-moz-range-thumb]:border-[var(--color-model-settings-range-input-thumb-border)]'
                    }
                    {/* Webkit Track Colors (existing logic) */}
                    ${disabled
                        ? '[&::-webkit-slider-runnable-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-webkit-slider-runnable-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    {/* Mozilla Track */}
                    [&::-moz-range-track]:h-0.5 /* Explicitly set track height */
                    [&::-moz-range-track]:rounded-lg
                    ${disabled /* Mozilla Track Colors */
                        ? '[&::-moz-range-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-moz-range-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                `}
            />
            <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">{helperText}</p>
        </div>
    );
};

export default RangeInput;
