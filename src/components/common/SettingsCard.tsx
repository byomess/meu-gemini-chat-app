import React from 'react';

interface SettingsCardProps {
    /**
     * The content to display when the card is NOT in editing mode.
     * This content should include its own padding as needed.
     */
    children: React.ReactNode;
    /**
     * The content to display when the card IS in editing mode.
     * This content should include its own padding as needed.
     */
    editForm?: React.ReactNode;
    /**
     * A boolean indicating whether the card is currently in editing mode.
     * If true, `editForm` will be rendered; otherwise, `children` will be rendered.
     */
    isEditing: boolean;
    /**
     * Optional ReactNode for action buttons (e.g., edit, delete).
     * These will be absolutely positioned at the top-right of the card.
     * Only rendered when `isEditing` is false.
     */
    actions?: React.ReactNode;
    /**
     * Optional additional CSS class names for the main card container div.
     */
    className?: string;
}

/**
 * A reusable card component for displaying and editing items within settings tabs.
 * It provides a consistent look and handles the switch between display and edit states.
 */
const SettingsCard: React.FC<SettingsCardProps> = ({
    children,
    editForm,
    isEditing,
    actions,
    className
}) => {
    return (
        <div className={`relative bg-[var(--color-table-row-bg)] rounded-lg shadow-md border border-[var(--color-table-row-border)] transition-colors ${!isEditing ? 'hover:bg-[var(--color-table-row-hover-bg)]' : ''} ${className || ''}`}>
            {isEditing ? (
                editForm
            ) : (
                <>
                    {actions && (
                        // Actions are positioned absolutely at the top-right
                        <div className="absolute top-[1px] right-[1px] flex space-x-1 z-10">
                            {actions}
                        </div>
                    )}
                    {children}
                </>
            )}
        </div>
    );
};

export default SettingsCard;
