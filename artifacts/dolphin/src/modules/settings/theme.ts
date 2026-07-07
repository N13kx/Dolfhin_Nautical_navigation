import type { ThemeMode } from './types';

/**
 * Apply a theme to the document root by toggling CSS classes.
 * Does NOT reload the page — instant switch.
 *
 * CSS convention:
 *   :root (no class)  — dark (default fallback, preserves current behavior)
 *   .dark             — explicit dark
 *   .light            — explicit light
 */
export function applyTheme(mode: ThemeMode): void {
  const html = document.documentElement;

  if (mode === 'auto') {
    html.removeAttribute('data-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', prefersDark);
    html.classList.toggle('light', !prefersDark);
  } else {
    html.setAttribute('data-theme', mode);
    html.classList.toggle('dark', mode === 'dark');
    html.classList.toggle('light', mode === 'light');
  }
}

/**
 * Install a listener that re-applies auto theme when the OS preference changes.
 * Returns a cleanup function.
 */
export function installAutoThemeListener(onToggle: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onToggle);
  return () => mq.removeEventListener('change', onToggle);
}
