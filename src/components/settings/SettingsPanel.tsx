// src/components/settings/SettingsPanel.tsx
import React from 'react';

interface SettingsPanelProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ title, description, children }) => {
    return (
        <div className="flex flex-col gap-4 pb-6">
            <h2 className="text-xl font-semibold text-[var(--color-settings-section-title-text)]">{title}</h2>
            <p className="text-sm text-[var(--color-settings-section-description-text)] pb-4 border-b border-[var(--color-settings-section-border)]">
                {description}
            </p>
            {children}
        </div>
    );
};

export default SettingsPanel;
