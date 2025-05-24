import React, { useState, useEffect } from 'react';

interface RangeInputProps {
    id: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

const RangeInput: React.FC<RangeInputProps> = ({
    id,
    min,
    max,
    step,
    value,
    onChange,
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
            {/* The label, tooltip, and numeric value display are now rendered outside this component */}
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
                    [&::-webkit-slider-runnable-track]:h-1
                    [&::-webkit-slider-runnable-track]:rounded-lg
                    ${disabled
                        ? '[&::-webkit-slider-runnable-track]:bg-[var(--color-range-slider-track-bg-disabled)] [&::-webkit-slider-runnable-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-webkit-slider-runnable-track]:bg-[var(--color-model-settings-range-input-bg)] [&::-webkit-slider-runnable-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:mt-[-8px]
                    ${disabled
                        ? '[&::-webkit-slider-thumb]:bg-[var(--color-range-slider-thumb-bg-disabled)] [&::-webkit-slider-thumb]:border-[var(--color-range-slider-thumb-border-disabled)]'
                        : '[&::-webkit-slider-thumb]:bg-[var(--color-model-settings-range-input-thumb)] [&::-webkit-slider-thumb]:border-[var(--color-model-settings-range-input-thumb-border)]'
                    }
                    [&::-moz-range-thumb]:appearance-none
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-::-moz-range-thumb]:border-2
                    [&::-moz-range-thumb]:shadow-lg
                    [&::-moz-range-thumb]:mt-[-8px]
                    ${disabled
                        ? '[&::-moz-range-thumb]:bg-[var(--color-range-slider-thumb-bg-disabled)] [&::-::-moz-range-thumb]:border-[var(--color-range-slider-thumb-border-disabled)]'
                        : '[&::-moz-range-thumb]:bg-[var(--color-model-settings-range-input-thumb)] [&::-moz-range-thumb]:border-[var(--color-model-settings-range-input-thumb-border)]'
                    }
                    [&::-moz-range-track]:h-1
                    [&::-moz-range-track]:rounded-lg
                    ${disabled
                        ? '[&::-moz-range-track]:bg-[var(--color-range-slider-track-bg-disabled)] [&::-moz-range-track]:bg-[var(--color-range-slider-fill-bg-disabled)]'
                        : '[&::-moz-range-track]:bg-[var(--color-model-settings-range-input-bg)] [&::-moz-range-track]:bg-[var(--color-model-settings-range-input-fill)]'
                    }
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-focus-ring-offset)]
                `}
            />
        </div>
    );
};

export default RangeInput;
