/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

export const THEMES = ["phosphor", "amber", "cyan"] as const;
export type Theme = (typeof THEMES)[number];

/** Also read by the inline script in index.html (applied before first paint). */
export const THEME_STORAGE_KEY = "retroizer.theme";
export const DEFAULT_THEME: Theme = "phosphor";

export function isTheme(value: unknown): value is Theme {
    return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Small typed wrapper around localStorage that never throws. */
export const preferences = {
    get(key: string): string | null {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key: string, value: string): void {
        try {
            window.localStorage.setItem(key, value);
        } catch {
            // Storage unavailable (private mode, blocked): keep it for this visit only.
        }
    },
};

export function loadTheme(): Theme {
    const stored = preferences.get(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
    root.dataset["theme"] = theme;
}

/** Wire the theme radio buttons: reflect the current theme, apply and save changes. */
export function bindThemePicker(radios: Iterable<HTMLInputElement>): void {
    const current = loadTheme();
    applyTheme(current);
    for (const radio of radios) {
        radio.checked = radio.value === current;
        radio.addEventListener("change", () => {
            if (!radio.checked || !isTheme(radio.value)) return;
            applyTheme(radio.value);
            preferences.set(THEME_STORAGE_KEY, radio.value);
        });
    }
}
