// src/constants/themes.ts

/**
 * All available theme names in the application.
 * This array serves as a single source of truth for theme names.
 */
export const ALL_THEME_NAMES = ['loox', 'aulapp', 'dracula-dark', 'solarized-light', 'one-dark', 'github-light'] as const;

/**
 * Theme names that are considered "dark" and should trigger the 'dark' class on the <html> element.
 */
export const DARK_THEME_NAMES = ['loox', 'dracula-dark', 'one-dark'] as const;
