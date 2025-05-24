import React, { useState, useEffect } from 'react';

interface RangeInputProps {
    id: string;
    label: string | React.ReactNode; // Changed to React.ReactNode to allow Tooltip
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
    helperText?: string; // Made optional as it will be moved to Tooltip
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
    helperText, // This prop will no longer be used for rendering directly
    disabled = false,
}) => {
    // Use internal state for the slider's immediate visual value
    const [displayValue, setDisplayValue] = useState(value);

    // Update internal state if the parent's value prop changes (e.g., external reset)
    useEffect(() => {
        setDisplayValue(value);
    }, [value]);

    // Handle immediate slider movement, updating only internal state
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayValue(parseFloat(e.target.value));
    };

    // Call the parent's onChange prop only when the user finishes dragging
    const handleMouseUp = () => {
        onChange(displayValue);
    };

    // Handle touch events for mobile devices
    const handleTouchEnd = () => {
        onChange(displayValue);
    };

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-[var(--color-model-settings-range-label-text)] mb-1.5">
                {label}: <span className={`font-semibold ${disabled ? 'text-[var(--color-range-slider-value-text-disabled)]' : 'text-[var(--color-model-settings-range-value-text)]'}`}>{displayValue}</span>
            </label>
            <input
                type="range"
                id={id}
                name={id}
                min={min}
                max={max}
                step={step}
                value={displayValue} // Bind to internal state
                onChange={handleInputChange} // Update internal state on every change
                onMouseUp={handleMouseUp} // Call parent onChange on mouse up
                onTouchEnd={handleTouchEnd} // Call parent onChange on touch end
                disabled={disabled}
                className={`w-full h-5 rounded-lg appearance-none cursor-pointer bg-transparent
                    {/* Webkit Track */}
                    [&::-webkit-slider-runnable-track]:h-1 /* Explicitly set track height */
                    [&::-webkit-slider-runnable-track]:rounded-lg
                    ${disabled /* Webkit Track Colors */
                        ? '[&::-webkit-slider-runnable-track]:bg-[var(--color-range-slider-track-bg-disabled)] [&::-webkit-slider-runnable-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-webkit-slider-runnable-track]:bg-[var(--color-model-settings-range-input-bg)] [&::-webkit-slider-runnable-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    {/* Webkit Thumb */}
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:h-5 /* Increased size */
                    [&::-webkit-slider-thumb]:w-5 /* Increased size */
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:border-2 /* Added border width */
                    [&::-webkit-slider-thumb]:shadow-lg /* Enhanced shadow */
                    [&::-webkit-slider-thumb]:mt-[-8px] /* Re-added to vertically center thumb on track */
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
                    [&::-moz-range-thumb]:mt-[-8px] /* Re-added to vertically center thumb on track */
                    ${disabled /* Mozilla Thumb Colors */
                        ? '[&::-moz-range-thumb]:bg-[var(--color-range-slider-thumb-bg-disabled)] [&::-::-moz-range-thumb]:border-[var(--color-range-slider-thumb-border-disabled)]'
                        : '[&::-moz-range-thumb]:bg-[var(--color-model-settings-range-input-thumb)] [&::-moz-range-thumb]:border-[var(--color-model-settings-range-input-thumb-border)]'
                    }
                    {/* Mozilla Track */}
                    [&::-moz-range-track]:h-1 /* Explicitly set track height */
                    [&::-moz-range-track]:rounded-lg
                    ${disabled /* Mozilla Track Colors */
                        ? '[&::-moz-range-track]:bg-[var(--color-range-slider-track-bg-disabled)] [&::-moz-range-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-moz-range-track]:bg-[var(--color-model-settings-range-input-bg)] [&::-moz-range-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                `}
            />
            {/* Removed: <p className="text-xs text-[var(--color-settings-section-description-text)] mt-1">{helperText}</p> */}
        </div>
    );
};

export default RangeInput;
