import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button/Button';
import { Card } from '@/components/Card/Card';
import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { StatTile } from '@/components/StatTile/StatTile';
import { WalletButton } from '@/components/WalletButton/WalletButton';
import { useApp } from '@/lib/app';
import { fmtPct, fmtUsd } from '@/lib/format';
import { AnimatedNumber, Reveal } from '@/lib/motion';
import type { ReserveWithUser } from '@shared/types';
import { AllocationDonut, type Slice } from './components/AllocationDonut';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { HealthGauge } from './components/HealthGauge';
import { BorrowRow, SupplyRow } from './components/PositionList';
import styles from './Dashboard.module.scss';

const usd0 = (n: number) => fmtUsd(n);

const toSlices = (reserves: ReserveWithUser[], key: 'suppliedUsd' | 'debtUsd'): Slice[] =>
    reserves
        .filter((r) => r[key] > 0)
        .map((r) => ({ symbol: r.symbol, address: r.underlying, usd: r[key] }))
        .sort((a, b) => b.usd - a.usd);

export const Dashboard = () => {
    const { portfolio } = useApp();
    const { account, reserves, loading, error, connected } = portfolio;

    const supplies = useMemo(() => reserves.filter((r) => r.supplied > 0), [reserves]);
    const borrows = useMemo(() => reserves.filter((r) => r.debt > 0), [reserves]);
    const collateralSlices = useMemo(() => toSlices(reserves, 'suppliedUsd'), [reserves]);
    const borrowSlices = useMemo(() => toSlices(reserves, 'debtUsd'), [reserves]);

    const market = useMemo(
        () => ({
            size: reserves.reduce((s, r) => s + r.totalSuppliedUsd, 0),
            borrowed: reserves.reduce((s, r) => s + r.totalDebtUsd, 0),
            assets: reserves.length
        }),
        [reserves]
    );

    if (loading && reserves.length === 0) {
        return <DashboardSkeleton />;
    }

    if (error && reserves.length === 0) {
        return (
            <Card title="Something went wrong">
                <p className={styles.errText}>{error}</p>
            </Card>
        );
    }

    if (!connected) {
        return (
            <div className={styles.hero}>
                <Reveal>
                    <h1 className={styles.heroTitle}>Your Aave v4 portfolio, beautifully clear.</h1>
                </Reveal>
                <Reveal delay={0.06}>
                    <p className={styles.heroSub}>Connect your wallet to view and manage your Aave v4 positions.</p>
                </Reveal>
                <Reveal delay={0.12} className={styles.heroCta}>
                    <WalletButton />
                </Reveal>
                <Reveal delay={0.18} className={styles.marketStrip}>
                    <div className={styles.marketStat}>
                        <StatTile label="Total Market Size" value={fmtUsd(market.size, true)} />
                    </div>
                    <div className={styles.marketStat}>
                        <StatTile label="Total Borrowed" value={fmtUsd(market.borrowed, true)} />
                    </div>
                    <div className={styles.marketStat}>
                        <StatTile label="Assets" value={market.assets} />
                    </div>
                </Reveal>
            </div>
        );
    }

    if (account && account.collateralUsd === 0 && account.debtUsd === 0) {
        return (
            <div className={styles.emptyState}>
                <Reveal>
                    <h1 className={styles.emptyTitle}>No positions yet</h1>
                </Reveal>
                <Reveal delay={0.06}>
                    <p className={styles.emptySub}>
                        Supply an asset to start earning yield or to unlock borrowing power on Aave v4.
                    </p>
                </Reveal>
                <Reveal delay={0.12}>
                    <Link to="/markets">
                        <Button size="lg">Explore Markets</Button>
                    </Link>
                </Reveal>
            </div>
        );
    }

    if (!account) return null;

    const netAprAccent = account.netApr >= 0 ? 'supply' : 'borrow';
    const netAprSign = account.netApr >= 0 ? '+' : '−';

    return (
        <div className={styles.page}>
            <Reveal>
                <div className={styles.heroStat}>
                    <span className={styles.heroLabel}>Net Worth</span>
                    <AnimatedNumber
                        className={styles.heroNumber}
                        value={account.netWorthUsd}
                        format={usd0}
                    />
                </div>
            </Reveal>

            <Reveal delay={0.06}>
                <div className={styles.statGrid}>
                    <div className={styles.statCard}>
                        <StatTile
                            label="Net APR"
                            value={`${netAprSign}${fmtPct(Math.abs(account.netApr))}`}
                            accent={netAprAccent}
                        />
                    </div>
                    <div className={styles.statCard}>
                        <StatTile
                            label="Health Factor"
                            value={
                                <span className={styles.healthBadgeRow}>
                                    <HealthBadge hf={account.healthFactor} size="lg" />
                                </span>
                            }
                        />
                    </div>
                    <div className={styles.statCard}>
                        <StatTile label="Available to Borrow" value={fmtUsd(account.availableBorrowsUsd)} />
                    </div>
                </div>
            </Reveal>

            <Reveal delay={0.12}>
                <div className={styles.charts}>
                    <Card title="Health">
                        <HealthGauge hf={account.healthFactor} />
                    </Card>
                    <div className={styles.donuts}>
                        <Card title="Collateral">
                            <AllocationDonut slices={collateralSlices} emptyLabel="No collateral supplied" />
                        </Card>
                        <Card title="Borrows">
                            <AllocationDonut slices={borrowSlices} emptyLabel="No outstanding borrows" />
                        </Card>
                    </div>
                </div>
            </Reveal>

            <Reveal delay={0.18}>
                <Card title="Your supplies">
                    {supplies.length === 0 ? (
                        <p className={styles.muted}>You have no supplied assets.</p>
                    ) : (
                        supplies.map((r) => <SupplyRow key={r.id} reserve={r} account={account.address} />)
                    )}
                </Card>
            </Reveal>

            <Reveal delay={0.24}>
                <Card title="Your borrows">
                    {borrows.length === 0 ? (
                        <p className={styles.muted}>You have no borrowed assets.</p>
                    ) : (
                        borrows.map((r) => <BorrowRow key={r.id} reserve={r} />)
                    )}
                </Card>
            </Reveal>
        </div>
    );
};
