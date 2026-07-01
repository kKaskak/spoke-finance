import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { fmtToken, fmtUsd } from '@/lib/format';
import { PLATFORM_LABEL, type PlatformKey } from '@/lib/platform';
import styles from './OtherPositions.module.scss';

export type OtherRow = {
    key: string;
    platform: PlatformKey;
    primarySymbol: string;
    primaryAddress: string;
    secondarySymbol?: string;
    secondaryAddress?: string;
    suppliedAmount: number;
    suppliedUsd: number;
    debtAmount: number;
    debtUsd: number;
    healthFactor: number | null | undefined;
};

type Props = {
    rows: OtherRow[];
};

export const OtherPositions = ({ rows }: Props) => {
    if (rows.length === 0) {
        return <p className={styles.muted}>No positions on other platforms.</p>;
    }
    return (
        <div className={styles.list}>
            {rows.map((r) => (
                <div key={r.key} className={styles.row}>
                    <div className={styles.asset}>
                        <div className={styles.icons}>
                            <TokenIcon symbol={r.primarySymbol} address={r.primaryAddress} size={30} />
                            {r.secondarySymbol && r.secondaryAddress && (
                                <TokenIcon symbol={r.secondarySymbol} address={r.secondaryAddress} size={18} />
                            )}
                        </div>
                        <div className={styles.assetText}>
                            <span className={styles.sym}>
                                {r.primarySymbol}
                                {r.secondarySymbol && <span className={styles.pairSep}> / {r.secondarySymbol}</span>}
                            </span>
                            <span className={styles.platformTag}>{PLATFORM_LABEL[r.platform]}</span>
                        </div>
                    </div>
                    <div className={styles.amount}>
                        <span className={styles.amountLabel}>Supplied</span>
                        <span className={styles.amountMain}>
                            {r.suppliedAmount > 0 ? fmtToken(r.suppliedAmount) : '—'}
                        </span>
                        <span className={styles.amountSub}>{fmtUsd(r.suppliedUsd)}</span>
                    </div>
                    <div className={styles.amount}>
                        <span className={styles.amountLabel}>Debt</span>
                        <span className={styles.amountMain}>{r.debtAmount > 0 ? fmtToken(r.debtAmount) : '—'}</span>
                        <span className={styles.amountSub}>{fmtUsd(r.debtUsd)}</span>
                    </div>
                    <div className={styles.health}>
                        {r.healthFactor === undefined ? (
                            <span className={styles.dash}>—</span>
                        ) : (
                            <HealthBadge hf={r.healthFactor} size="sm" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
