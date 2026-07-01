import { useMemo, useState } from 'react';
import { Card } from '@/components/Card/Card';
import { StatTile } from '@/components/StatTile/StatTile';
import { useApp } from '@/lib/app';
import { fmtUsd } from '@/lib/format';
import { AnimatedNumber, Reveal } from '@/lib/motion';
import { isNoisyPool } from '@/lib/poolFilter';
import type { ReserveWithUser } from '@shared/types';
import { MarketTable } from './MarketTable';
import { MarketsBarChart } from './MarketsBarChart';
import { MarketsSkeleton } from './MarketsSkeleton';
import styles from '../Markets.module.scss';

const usdC = (n: number) => fmtUsd(n, true);
const countC = (n: number) => Math.round(n).toString();

const COLLATERAL_COLS = '1.4fr 0.8fr 1.1fr 1fr 1fr';
const COLLATERAL_COLS_GUEST = '1.6fr 1fr 1.3fr';
const BORROW_COLS = '1.4fr 0.9fr 0.9fr 1.2fr 1.1fr 1fr';
const BORROW_COLS_GUEST = '1.5fr 1fr 1fr 1.3fr 1.2fr';

const collateralHeaders = (connected: boolean): string[] =>
    connected
        ? ['Asset', 'Max LTV', 'Total supplied', 'Your wallet', 'Your supplied']
        : ['Asset', 'Max LTV', 'Total supplied'];

const borrowHeaders = (connected: boolean): string[] =>
    connected
        ? ['Asset', 'Borrow APR', 'Supply APR', 'Utilization', 'Available', 'Your debt']
        : ['Asset', 'Borrow APR', 'Supply APR', 'Utilization', 'Available'];

const noop = () => {};

type Props = {
    reserves: ReserveWithUser[];
    loading: boolean;
};

export const AaveV3Markets = ({ reserves, loading }: Props) => {
    const { portfolio } = useApp();
    const connected = portfolio.connected;

    const [showAllBorrow, setShowAllBorrow] = useState(false);

    const collateral = useMemo(() => reserves.filter((r) => r.canBeCollateral), [reserves]);
    const borrowAll = useMemo(() => reserves.filter((r) => r.borrowable), [reserves]);
    const hiddenBorrowCount = useMemo(() => borrowAll.filter((r) => isNoisyPool(r.utilization)).length, [borrowAll]);
    const borrow = useMemo(
        () => (showAllBorrow ? borrowAll : borrowAll.filter((r) => !isNoisyPool(r.utilization))),
        [borrowAll, showAllBorrow]
    );

    const stats = useMemo(() => {
        const size = reserves.reduce((s, r) => s + r.totalSuppliedUsd, 0);
        const borrowed = reserves.reduce((s, r) => s + r.totalDebtUsd, 0);
        return { size, borrowed, liquidity: Math.max(0, size - borrowed), count: reserves.length };
    }, [reserves]);

    if (loading && reserves.length === 0) {
        return <MarketsSkeleton />;
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
                                onAct={noop}
                                actions={false}
                            />
                        </Card>
                    </section>
                </Reveal>
            )}

            {borrowAll.length > 0 && (
                <Reveal delay={0.2}>
                    <section className={styles.section}>
                        <div className={styles.sectionHead}>
                            <h2 className={styles.sectionTitle}>Borrow assets</h2>
                            {hiddenBorrowCount > 0 && (
                                <button type="button" className={styles.toggleLink} onClick={() => setShowAllBorrow((v) => !v)}>
                                    {showAllBorrow ? 'Hide full & idle pools' : `Show ${hiddenBorrowCount} full & idle pool${hiddenBorrowCount === 1 ? '' : 's'}`}
                                </button>
                            )}
                        </div>
                        <Card pad={false}>
                            {borrow.length === 0 ? (
                                <p className={styles.mutedPad}>All markets here are at full utilization or idle.</p>
                            ) : (
                                <MarketTable
                                    headers={borrowHeaders(connected)}
                                    cols={connected ? BORROW_COLS : BORROW_COLS_GUEST}
                                    reserves={borrow}
                                    variant="borrow"
                                    connected={connected}
                                    onAct={noop}
                                    actions={false}
                                />
                            )}
                        </Card>
                    </section>
                </Reveal>
            )}
        </>
    );
};
