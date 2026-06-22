import { useCallback, useMemo } from 'react';
import { Card } from '@/components/Card/Card';
import { StatTile } from '@/components/StatTile/StatTile';
import { useApp } from '@/lib/app';
import { fmtUsd } from '@/lib/format';
import { AnimatedNumber, Reveal } from '@/lib/motion';
import { useWallet } from '@/lib/wallet';
import type { ActionKind, ReserveWithUser } from '@shared/types';
import { MarketRow } from './components/MarketRow';
import { MarketsBarChart } from './components/MarketsBarChart';
import { MarketsSkeleton } from './components/MarketsSkeleton';
import styles from './Markets.module.scss';

const COLLATERAL_COLS = '1.4fr 0.8fr 1.1fr 1fr 1fr 1.4fr';
const COLLATERAL_COLS_GUEST = '1.6fr 1fr 1.3fr 1.6fr';
const BORROW_COLS = '1.4fr 0.9fr 0.9fr 1.2fr 1.1fr 1fr 1.6fr';
const BORROW_COLS_GUEST = '1.5fr 1fr 1fr 1.3fr 1.2fr 1.6fr';

const usdC = (n: number) => fmtUsd(n, true);
const countC = (n: number) => Math.round(n).toString();

const collateralHeaders = (connected: boolean): string[] =>
    connected
        ? ['Asset', 'Max LTV', 'Total supplied', 'Your wallet', 'Your supplied', '']
        : ['Asset', 'Max LTV', 'Total supplied', ''];

const borrowHeaders = (connected: boolean): string[] =>
    connected
        ? ['Asset', 'Borrow APR', 'Supply APR', 'Utilization', 'Available', 'Your debt', '']
        : ['Asset', 'Borrow APR', 'Supply APR', 'Utilization', 'Available', ''];

type TableProps = {
    headers: string[];
    cols: string;
    reserves: ReserveWithUser[];
    variant: 'collateral' | 'borrow';
    connected: boolean;
    onAct: (id: number, kind: ActionKind) => void;
};

const MarketTable = ({ headers, cols, reserves, variant, connected, onAct }: TableProps) => (
    <div className={styles.table} style={{ ['--cols' as string]: cols }}>
        <div className={styles.header} style={{ ['--cols' as string]: cols }}>
            {headers.map((h, i) => (
                <span key={h || `spacer-${i}`} className={i === 0 ? undefined : styles.headEnd}>
                    {h}
                </span>
            ))}
        </div>
        {reserves.map((r) => (
            <MarketRow key={r.id} reserve={r} variant={variant} connected={connected} onAct={onAct} />
        ))}
    </div>
);

export const Markets = () => {
    const { portfolio, openAction } = useApp();
    const { connect } = useWallet();
    const { reserves, connected, loading, error } = portfolio;

    const onAct = useCallback(
        (id: number, kind: ActionKind) => {
            if (connected) openAction(id, kind);
            else void connect();
        },
        [connected, openAction, connect]
    );

    const collateral = useMemo(() => reserves.filter((r) => r.canBeCollateral), [reserves]);
    const borrow = useMemo(() => reserves.filter((r) => r.borrowable), [reserves]);

    const stats = useMemo(() => {
        const size = reserves.reduce((s, r) => s + r.totalSuppliedUsd, 0);
        const borrowed = reserves.reduce((s, r) => s + r.totalDebtUsd, 0);
        return { size, borrowed, liquidity: Math.max(0, size - borrowed), count: reserves.length };
    }, [reserves]);

    if (loading && reserves.length === 0) {
        return <MarketsSkeleton />;
    }

    if (error && reserves.length === 0) {
        return (
            <div className={styles.center}>
                <Card title="Unable to load markets">
                    <p className={styles.error}>{error}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <Reveal>
                <header className={styles.head}>
                    <h1 className={styles.title}>Markets</h1>
                    <p className={styles.subtitle}>
                        Supply bluechip collateral and borrow stablecoins across the Aave v4 protocol.
                    </p>
                </header>
            </Reveal>

            <Reveal delay={0.05}>
                <div className={styles.stats}>
                    <StatTile label="Total market size" value={<AnimatedNumber value={stats.size} format={usdC} />} />
                    <StatTile
                        label="Total borrowed"
                        value={<AnimatedNumber value={stats.borrowed} format={usdC} />}
                    />
                    <StatTile
                        label="Available liquidity"
                        value={<AnimatedNumber value={stats.liquidity} format={usdC} />}
                        accent="supply"
                    />
                    <StatTile label="Assets" value={<AnimatedNumber value={stats.count} format={countC} />} />
                </div>
            </Reveal>

            <Reveal delay={0.1}>
                <Card title="Markets by size">
                    <MarketsBarChart reserves={reserves} />
                </Card>
            </Reveal>

            {collateral.length > 0 && (
                <Reveal delay={0.15}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Collateral assets</h2>
                        <Card pad={false}>
                            <MarketTable
                                headers={collateralHeaders(connected)}
                                cols={connected ? COLLATERAL_COLS : COLLATERAL_COLS_GUEST}
                                reserves={collateral}
                                variant="collateral"
                                connected={connected}
                                onAct={onAct}
                            />
                        </Card>
                    </section>
                </Reveal>
            )}

            {borrow.length > 0 && (
                <Reveal delay={0.2}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Borrow assets</h2>
                        <Card pad={false}>
                            <MarketTable
                                headers={borrowHeaders(connected)}
                                cols={connected ? BORROW_COLS : BORROW_COLS_GUEST}
                                reserves={borrow}
                                variant="borrow"
                                connected={connected}
                                onAct={onAct}
                            />
                        </Card>
                    </section>
                </Reveal>
            )}
        </div>
    );
};
