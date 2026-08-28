import { toggleTheme, useTheme } from '@/lib/theme';
import styles from './ThemeToggle.module.scss';

const Sun = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
        <path d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-13.5a1 1 0 0 1-1-1V1a1 1 0 1 1 2 0v1.5a1 1 0 0 1-1 1zm0 19a1 1 0 0 1-1-1V20a1 1 0 1 1 2 0v1.5a1 1 0 0 1-1 1zM22 13h-1.5a1 1 0 1 1 0-2H22a1 1 0 1 1 0 2zm-18.5 0H2a1 1 0 1 1 0-2h1.5a1 1 0 1 1 0 2zm14.9-7.4a1 1 0 0 1-.7-1.7l1-1.1a1 1 0 0 1 1.5 1.5l-1.1 1a1 1 0 0 1-.7.3zM5.4 19.6a1 1 0 0 1-.7-1.7l1-1.1a1 1 0 1 1 1.5 1.5l-1.1 1a1 1 0 0 1-.7.3zm13.2 0a1 1 0 0 1-.7-.3l-1.1-1a1 1 0 0 1 1.5-1.5l1 1.1a1 1 0 0 1-.7 1.7zM5.4 4.4a1 1 0 0 1-.7-.3l-1-1.1A1 1 0 0 1 5.2 1.5l1.1 1a1 1 0 0 1-.7 1.7z" />
    </svg>
);

const Moon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
        <path d="M21.5 14.1A9.5 9.5 0 1 1 9.9 2.5a7.5 7.5 0 0 0 11.6 11.6z" />
    </svg>
);

export const ThemeToggle = () => {
    const theme = useTheme();
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

    return (
        <button type="button" className={styles.toggle} onClick={toggleTheme} aria-label={label} title={label}>
            {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
    );
};
