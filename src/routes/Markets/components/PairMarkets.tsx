import { useMemo, useState } from 'react';
import { Card } from '@/components/Card/Card';
import { StatTile } from '@/components/StatTile/StatTile';
import { fmtUsd } from '@/lib/format';
import { AnimatedNumber, Reveal } from '@/lib/motion';
import type { PairMarket } from '@shared/types';
import { MarketsSkeleton } from './MarketsSkeleton';
import { PairMarketRow } from './PairMarketRow';
import styles from '../Markets.module.scss';

const usdC = (n: number) => fmtUsd(n, true);
const countC = (n: number) => Math.round(n).toString();

const COLS = '1.6fr 0.9fr 1.1fr 1.1fr 0.9fr 0.9fr 1.2fr';
const HEADERS = ['Market', 'Max LTV', 'Total supplied', 'Total borrowed', 'Supply APR', 'Borrow APR', 'Utilization'];

const FULL_THRESHOLD = 0.98;
const IDLE_THRESHOLD = 0.001;
const isNoise = (m: PairMarket) => m.utilization >= FULL_THRESHOLD || m.utilization <= IDLE_THRESHOLD;

type Props = {
    markets: PairMarket[];
    loading: boolean;
};

export const PairMarkets = ({ markets, loading }: Props) => {
    const [showAll, setShowAll] = useState(false);

    const stats = useMemo(() => {
        const size = markets.reduce((s, m) => s + m.totalSuppliedUsd, 0);
        const borrowed = markets.reduce((s, m) => s + m.totalDebtUsd, 0);
        return { size, borrowed, liquidity: Math.max(0, size - borrowed), count: markets.length };
    }, [markets]);

    const hiddenCount = useMemo(() => markets.filter(isNoise).length, [markets]);
    const visible = useMemo(() => (showAll ? markets : markets.filter((m) => !isNoise(m))), [markets, showAll]);

    if (loading && markets.length === 0) {
        return <MarketsSkeleton />;
    }

    if (markets.length === 0) {
        return (
            <div className={styles.center}>
                <Card title="Markets unavailable">
                    <p className={styles.error}>Could not load markets right now. Try again shortly.</p>
                </Card>
            </div>
        );
    }

    return (
        <>
            <Reveal delay={0.05}>
                <div className={styles.stats}>
                    <StatTile label="Total market size" value={<AnimatedNumber value={stats.size} format={usdC} />} />
                    <StatTile label="Total borrowed" value={<AnimatedNumber value={stats.borrowed} format={usdC} />} />
                    <StatTile
                        label="Available liquidity"
                        value={<AnimatedNumber value={stats.liquidity} format={usdC} />}
                        accent="supply"
                    />
                    <StatTile label="Markets" value={<AnimatedNumber value={stats.count} format={countC} />} />
                </div>
            </Reveal>

            <Reveal delay={0.1}>
                <Card
                    title="Markets"
                    pad={false}
                    action={
                        hiddenCount > 0 && (
                            <button type="button" className={styles.toggleLink} onClick={() => setShowAll((v) => !v)}>
                                {showAll ? 'Hide full & idle pools' : `Show ${hiddenCount} full & idle pool${hiddenCount === 1 ? '' : 's'}`}
                            </button>
                        )
                    }
                >
                    {visible.length === 0 ? (
                        <p className={styles.mutedPad}>All markets here are at full utilization or idle.</p>
                    ) : (
                        <div className={styles.table} style={{ ['--cols' as string]: COLS }}>
                            <div className={styles.header} style={{ ['--cols' as string]: COLS }}>
                                {HEADERS.map((h, i) => (
                                    <span key={h} className={i === 0 ? undefined : styles.headEnd}>
                                        {h}
                                    </span>
                                ))}
                            </div>
                            {visible.map((m) => (
                                <PairMarketRow key={m.id} market={m} />
                            ))}
                        </div>
                    )}
                </Card>
            </Reveal>
        </>
    );
};
