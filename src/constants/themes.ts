// src/constants/themes.ts
import type { ThemeName } from '../types'; // Import ThemeName

/**
 * All available theme names in the application.
 * This array serves as a single source of truth for theme names.
 */
export const ALL_THEME_NAMES = ['loox', 'aulapp', 'dracula-dark', 'solarized-light', 'one-dark', 'github-light', 'shades-of-purple', 'shades-of-purple-light', 'neon-shades-of-purple'] as const;

/**
 * Theme names that are considered "dark" and should trigger the 'dark' class on the <html> element.
 */
export const DARK_THEME_NAMES: readonly ThemeName[] = ['loox', 'dracula-dark', 'one-dark', 'shades-of-purple', 'neon-shades-of-purple'];
