import { Skeleton } from '@/components/Skeleton/Skeleton';
import styles from './MarketsSkeleton.module.scss';

export const MarketsSkeleton = () => (
    <div className={styles.page}>
        <div className={styles.stats}>
            {[0, 1, 2, 3].map((i) => (
                <div className={styles.stat} key={i}>
                    <Skeleton width={90} height={13} radius={6} />
                    <Skeleton width={110} height={28} radius={8} />
                </div>
            ))}
        </div>
        <div className={styles.card}>
            <Skeleton width={120} height={15} radius={6} />
            <div className={styles.bars}>
                {[88, 70, 56, 40, 32, 26, 16].map((w, i) => (
                    <div className={styles.barRow} key={i}>
                        <Skeleton width={70} height={14} radius={6} />
                        <Skeleton width={`${w}%`} height={14} radius={7} />
                    </div>
                ))}
            </div>
        </div>
        {[0, 1].map((s) => (
            <div className={styles.section} key={s}>
                <Skeleton width={140} height={22} radius={7} />
                <div className={styles.card}>
                    {[0, 1, 2, 3].map((r) => (
                        <div className={styles.tableRow} key={r}>
                            <Skeleton width={32} height={32} radius="50%" />
                            <Skeleton width={90} height={16} radius={6} />
                            <Skeleton width={120} height={32} radius={16} className={styles.rowEnd} />
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);
