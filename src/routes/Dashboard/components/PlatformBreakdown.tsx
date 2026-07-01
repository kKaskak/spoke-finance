import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { PlatformIcon } from '@/components/PlatformIcon/PlatformIcon';
import { fmtUsd } from '@/lib/format';
import type { PlatformKey } from '@/lib/platform';
import styles from './PlatformBreakdown.module.scss';

export type PlatformRow = {
    platform: PlatformKey;
    label: string;
    collateralUsd: number;
    debtUsd: number;
    availableBorrowsUsd: number;
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
                    <PlatformIcon platform={p.platform} size={30} />
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
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Available</span>
                    <span className={styles.statValue}>{fmtUsd(p.availableBorrowsUsd, true)}</span>
                </div>
                <div className={styles.health}>
                    <HealthBadge hf={p.healthFactor} size="sm" />
                </div>
            </div>
        ))}
    </div>
);
