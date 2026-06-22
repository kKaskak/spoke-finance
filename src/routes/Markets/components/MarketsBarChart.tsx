import { motion } from 'motion/react';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { fmtPct, fmtUsd } from '@/lib/format';
import { EASE } from '@/lib/motion';
import type { ReserveWithUser } from '@shared/types';
import styles from './MarketsBarChart.module.scss';

type Props = {
    reserves: ReserveWithUser[];
};

export const MarketsBarChart = ({ reserves }: Props) => {
    const rows = [...reserves]
        .filter((r) => r.totalSuppliedUsd > 0)
        .sort((a, b) => b.totalSuppliedUsd - a.totalSuppliedUsd);

    if (rows.length === 0) return null;
    const max = rows[0].totalSuppliedUsd;

    return (
        <div className={styles.wrap}>
            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <span className={[styles.swatch, styles.swatchSupplied].join(' ')} />
                    Available
                </span>
                <span className={styles.legendItem}>
                    <span className={[styles.swatch, styles.swatchBorrowed].join(' ')} />
                    Borrowed
                </span>
            </div>
            <div className={styles.rows}>
                {rows.map((r, i) => {
                    const width = (r.totalSuppliedUsd / max) * 100;
                    const borrowedShare = r.totalSuppliedUsd > 0 ? Math.min(1, r.totalDebtUsd / r.totalSuppliedUsd) : 0;
                    return (
                        <div className={styles.row} key={r.id}>
                            <div className={styles.label}>
                                <TokenIcon symbol={r.symbol} address={r.underlying} size={22} />
                                <span className={styles.sym}>{r.symbol}</span>
                            </div>
                            <div className={styles.track}>
                                <motion.div
                                    className={styles.fill}
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${width}%` }}
                                    viewport={{ once: true, margin: '-20px' }}
                                    transition={{ duration: 0.9, delay: i * 0.05, ease: EASE }}
                                >
                                    <span className={styles.borrowed} style={{ width: `${borrowedShare * 100}%` }} />
                                </motion.div>
                            </div>
                            <div className={styles.meta}>
                                <span className={styles.value}>{fmtUsd(r.totalSuppliedUsd, true)}</span>
                                <span className={styles.util}>{borrowedShare > 0 ? `${fmtPct(borrowedShare, 0)} used` : 'idle'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
