import { fmtPct } from '@/lib/format';
import styles from './UtilizationBar.module.scss';

type Props = {
    value: number;
};

const tone = (v: number): 'good' | 'warn' | 'bad' => {
    if (v >= 0.9) return 'bad';
    if (v >= 0.75) return 'warn';
    return 'good';
};

export const UtilizationBar = ({ value }: Props) => {
    const pct = Math.max(0, Math.min(1, value));
    return (
        <div className={styles.wrap}>
            <div className={styles.track}>
                <div className={[styles.fill, styles[tone(pct)]].join(' ')} style={{ width: `${pct * 100}%` }} />
            </div>
            <span className={styles.label}>{fmtPct(value)}</span>
        </div>
    );
};
