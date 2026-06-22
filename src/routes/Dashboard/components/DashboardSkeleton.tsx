import { Skeleton } from '@/components/Skeleton/Skeleton';
import styles from './DashboardSkeleton.module.scss';

export const DashboardSkeleton = () => (
    <div className={styles.page}>
        <div className={styles.hero}>
            <Skeleton width={88} height={14} radius={7} />
            <Skeleton width={320} height={62} radius={16} />
        </div>
        <div className={styles.stats}>
            {[0, 1, 2].map((i) => (
                <div className={styles.card} key={i}>
                    <Skeleton width={90} height={13} radius={6} />
                    <Skeleton width={130} height={30} radius={9} />
                </div>
            ))}
        </div>
        <div className={styles.charts}>
            {[0, 1, 2].map((i) => (
                <div className={styles.chartCard} key={i}>
                    <Skeleton width={80} height={14} radius={6} />
                    <div className={styles.chartBody}>
                        <Skeleton width={130} height={130} radius="50%" />
                    </div>
                </div>
            ))}
        </div>
        {[0, 1].map((i) => (
            <div className={styles.listCard} key={i}>
                <Skeleton width={110} height={14} radius={6} />
                {[0, 1].map((j) => (
                    <div className={styles.listRow} key={j}>
                        <Skeleton width={32} height={32} radius="50%" />
                        <Skeleton width={120} height={18} radius={6} />
                        <Skeleton width={150} height={32} radius={16} className={styles.rowEnd} />
                    </div>
                ))}
            </div>
        ))}
    </div>
);
