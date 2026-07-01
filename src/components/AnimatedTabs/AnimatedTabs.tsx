import { motion } from 'motion/react';
import styles from './AnimatedTabs.module.scss';

type Tab<T extends string> = {
    value: T;
    label: string;
};

type Props<T extends string> = {
    tabs: Tab<T>[];
    active: T;
    onChange: (value: T) => void;
    layoutId: string;
    fullWidth?: boolean;
};

export const AnimatedTabs = <T extends string>({ tabs, active, onChange, layoutId, fullWidth }: Props<T>) => (
    <div className={[styles.tabs, fullWidth ? styles.fullWidth : ''].join(' ')}>
        {tabs.map((t) => (
            <button key={t.value} type="button" className={styles.tab} onClick={() => onChange(t.value)}>
                {active === t.value && (
                    <motion.span
                        layoutId={layoutId}
                        className={styles.tabBg}
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                )}
                <span className={[styles.tabLabel, active === t.value ? styles.tabLabelActive : ''].join(' ')}>
                    {t.label}
                </span>
            </button>
        ))}
    </div>
);
