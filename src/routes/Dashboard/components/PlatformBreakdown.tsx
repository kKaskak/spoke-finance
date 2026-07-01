import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { fmtUsd } from '@/lib/format';
import { PLATFORM_COLOR, type PlatformKey } from '@/lib/platform';
import styles from './PlatformBreakdown.module.scss';

export type PlatformRow = {
    platform: PlatformKey;
    label: string;
    collateralUsd: number;
    debtUsd: number;
    healthFactor: number | null;
};

type Props = {
    rows: PlatformRow[];
};

export const PlatformBreakdown = ({ rows }: Props) => (
    <div className={styles.list}>
        {rows.map((p) => (
            <div key={p.platform} className={styles.row}>
                <div className={styles.name}>
                    <span className={styles.dot} style={{ background: PLATFORM_COLOR[p.platform] }} />
                    <span className={styles.label}>{p.label}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Collateral</span>
                    <span className={styles.statValue}>{fmtUsd(p.collateralUsd, true)}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Debt</span>
                    <span className={styles.statValue}>{fmtUsd(p.debtUsd, true)}</span>
                </div>
                <div className={styles.health}>
                    <HealthBadge hf={p.healthFactor} size="sm" />
                </div>
            </div>
        ))}
    </div>
);
