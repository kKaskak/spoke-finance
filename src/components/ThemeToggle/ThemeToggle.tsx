import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from '@/lib/theme';
import styles from './ThemeToggle.module.scss';

export const ThemeToggle = () => {
    const theme = useTheme();
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    const Icon = theme === 'dark' ? Sun : Moon;

    return (
        <button type="button" className={styles.toggle} onClick={toggleTheme} aria-label={label} title={label}>
            <Icon size={17} strokeWidth={1.75} aria-hidden />
        </button>
    );
};
