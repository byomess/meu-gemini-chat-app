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
    /**
     * Optional boolean to indicate if the card represents a native item.
     * Can be used for distinct styling.
     */
    isNative?: boolean;
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
    className,
    isNative
}) => {
    const nativeClasses = isNative ? 'border-[var(--color-native-item-border)] bg-[var(--color-native-item-bg)] hover:bg-[var(--color-native-item-hover-bg)]' : 'border-[var(--color-table-row-border)] bg-[var(--color-table-row-bg)] hover:bg-[var(--color-table-row-hover-bg)]';
    const editingClasses = isEditing ? 'border-[var(--color-table-item-edit-border)] bg-[var(--color-table-item-edit-bg)]' : nativeClasses;

    return (
        <div className={`relative rounded-lg shadow-md transition-colors ${editingClasses} ${className || ''}`}>
            {isEditing ? (
                editForm
            ) : (
                <>
                    {actions && (
                        <div className="absolute top-[1px] right-[1px] flex space-x-1 z-10 p-1.5">
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
