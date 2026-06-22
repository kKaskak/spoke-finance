import { fmtHealth, healthTone } from '@/lib/format';
import styles from './HealthBadge.module.scss';

type Props = {
    hf: number | null;
    projected?: number | null;
    size?: 'sm' | 'lg';
};

export const HealthBadge = ({ hf, projected, size = 'sm' }: Props) => {
    const hasProjection = projected !== undefined && projected !== null;
    return (
        <span className={[styles.badge, styles[size]].join(' ')}>
            <span className={[styles.dot, styles[healthTone(hf)]].join(' ')} />
            <span className={[styles.value, styles[healthTone(hf)]].join(' ')}>{fmtHealth(hf)}</span>
            {hasProjection && (
                <>
                    <span className={styles.arrow}>→</span>
                    <span className={[styles.value, styles[healthTone(projected)]].join(' ')}>
                        {fmtHealth(projected)}
                    </span>
                </>
            )}
        </span>
    );
};
