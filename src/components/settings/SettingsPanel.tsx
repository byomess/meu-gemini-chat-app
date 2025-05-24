// src/components/settings/SettingsPanel.tsx
import React from 'react';

interface SettingsPanelProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ title, description, children }) => {
    return (
        <>
            <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)]">{title}</h2>
            <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4 border-b border-[var(--color-settings-section-border)]">
                {description}
            </p>
            {children}
        </>
    );
};

export default SettingsPanel;
