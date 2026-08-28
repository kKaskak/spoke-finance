import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const KEY = 'spoke-theme';
const query = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

const read = (): Theme | null => {
    try {
        const value = localStorage.getItem(KEY);
        return value === 'light' || value === 'dark' ? value : null;
    } catch {
        return null;
    }
};

let stored = read();

const snapshot = (): Theme => stored ?? (query.matches ? 'dark' : 'light');

const paint = () => {
    const theme = snapshot();
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
};

const emit = () => {
    paint();
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

query.addEventListener('change', emit);
paint();

export const toggleTheme = () => {
    const theme = snapshot() === 'dark' ? 'light' : 'dark';
    stored = theme;
    try {
        localStorage.setItem(KEY, theme);
    } catch {}
    emit();
};

export const useTheme = () => useSyncExternalStore(subscribe, snapshot);
