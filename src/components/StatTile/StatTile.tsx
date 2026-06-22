import type { ReactNode } from 'react';
import styles from './StatTile.module.scss';

type Props = {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    accent?: 'default' | 'supply' | 'borrow' | 'gradient';
};

export const StatTile = ({ label, value, sub, accent = 'default' }: Props) => (
    <div className={styles.tile}>
        <span className={styles.label}>{label}</span>
        <span className={[styles.value, styles[accent]].join(' ')}>{value}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
    </div>
);
