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
import type { PlatformKey } from '@/lib/platform';
import type { PairPosition, ReserveWithUser } from '@shared/types';
import { AllocationDonut, type Slice } from './components/AllocationDonut';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { HealthGauge } from './components/HealthGauge';
import { LoopSimulator } from './components/LoopSimulator';
import { type OtherRow, OtherPositions } from './components/OtherPositions';
import { type PlatformRow, PlatformBreakdown } from './components/PlatformBreakdown';
import { BorrowRow, SupplyRow } from './components/PositionList';
import styles from './Dashboard.module.scss';

const usd0 = (n: number) => fmtUsd(n);

const toSlices = (reserves: ReserveWithUser[], key: 'suppliedUsd' | 'debtUsd', platform: PlatformKey): Slice[] =>
    reserves
        .filter((r) => r[key] > 0)
        .map((r) => ({ id: `${platform}:${r.underlying}`, symbol: r.symbol, address: r.underlying, usd: r[key], platform }));

const pairToSlices = (positions: PairPosition[], key: 'suppliedUsd' | 'debtUsd', platform: PlatformKey): Slice[] =>
    positions
        .filter((p) => p[key] > 0)
        .map((p) => {
            const isSupply = key === 'suppliedUsd';
            return {
                id: `${platform}:${p.id}:${key}`,
                symbol: isSupply ? p.supplySymbol : p.borrowSymbol,
                address: isSupply ? p.supplyAddress : p.borrowAddress,
                usd: p[key],
                platform
            };
        });

const pairAvailableToBorrow = (positions: PairPosition[]): number =>
    positions.reduce((s, p) => s + Math.max(0, p.suppliedUsd * p.maxLtv - p.debtUsd), 0);

const pairToRows = (positions: PairPosition[], platform: 'morpho' | 'fluid'): OtherRow[] =>
    positions.map((p) => ({
        key: `${platform}:${p.id}`,
        platform,
        primarySymbol: p.supplySymbol,
        primaryAddress: p.supplyAddress,
        secondarySymbol: p.borrowSymbol,
        secondaryAddress: p.borrowAddress,
        suppliedAmount: p.supplied,
        suppliedUsd: p.suppliedUsd,
        debtAmount: p.debt,
        debtUsd: p.debtUsd,
        healthFactor: p.healthFactor
    }));

export const Dashboard = () => {
    const { portfolio, otherPlatforms } = useApp();
    const { account, reserves, loading, error, connected } = portfolio;
    const { aaveV3Reserves, aaveV3Account, morpho, fluid } = otherPlatforms;

    const supplies = useMemo(() => reserves.filter((r) => r.supplied > 0), [reserves]);
    const borrows = useMemo(() => reserves.filter((r) => r.debt > 0), [reserves]);

    const collateralSlices = useMemo(
        () => [
            ...toSlices(reserves, 'suppliedUsd', 'aave-v4'),
            ...toSlices(aaveV3Reserves, 'suppliedUsd', 'aave-v3'),
            ...pairToSlices(morpho.positions, 'suppliedUsd', 'morpho'),
            ...pairToSlices(fluid.positions, 'suppliedUsd', 'fluid')
        ].sort((a, b) => b.usd - a.usd),
        [reserves, aaveV3Reserves, morpho.positions, fluid.positions]
    );
    const borrowSlices = useMemo(
        () => [
            ...toSlices(reserves, 'debtUsd', 'aave-v4'),
            ...toSlices(aaveV3Reserves, 'debtUsd', 'aave-v3'),
            ...pairToSlices(morpho.positions, 'debtUsd', 'morpho'),
            ...pairToSlices(fluid.positions, 'debtUsd', 'fluid')
        ].sort((a, b) => b.usd - a.usd),
        [reserves, aaveV3Reserves, morpho.positions, fluid.positions]
    );

    const platformRows: PlatformRow[] = useMemo(
        () =>
            account
                ? [
                      {
                          platform: 'aave-v4',
                          label: 'Aave v4',
                          collateralUsd: account.collateralUsd,
                          debtUsd: account.debtUsd,
                          availableBorrowsUsd: account.availableBorrowsUsd,
                          healthFactor: account.healthFactor
                      },
                      {
                          platform: 'aave-v3',
                          label: 'Aave v3',
                          collateralUsd: aaveV3Account?.collateralUsd ?? 0,
                          debtUsd: aaveV3Account?.debtUsd ?? 0,
                          availableBorrowsUsd: aaveV3Account?.availableBorrowsUsd ?? 0,
                          healthFactor: aaveV3Account?.healthFactor ?? null
                      },
                      {
                          platform: 'morpho',
                          label: 'Morpho',
                          collateralUsd: morpho.collateralUsd,
                          debtUsd: morpho.debtUsd,
                          availableBorrowsUsd: pairAvailableToBorrow(morpho.positions),
                          healthFactor: morpho.healthFactor
                      },
                      {
                          platform: 'fluid',
                          label: 'Fluid',
                          collateralUsd: fluid.collateralUsd,
                          debtUsd: fluid.debtUsd,
                          availableBorrowsUsd: pairAvailableToBorrow(fluid.positions),
                          healthFactor: fluid.healthFactor
                      }
                  ]
                : [],
        [account, aaveV3Account, morpho, fluid]
    );

    const totalCollateralUsd = platformRows.reduce((s, p) => s + p.collateralUsd, 0);
    const totalDebtUsd = platformRows.reduce((s, p) => s + p.debtUsd, 0);
    const totalNetWorthUsd = totalCollateralUsd - totalDebtUsd;
    const platformHfs = platformRows.map((p) => p.healthFactor).filter((hf): hf is number => hf !== null);
    const overallHealthFactor = platformHfs.length > 0 ? Math.min(...platformHfs) : null;

    const otherRows: OtherRow[] = useMemo(
        () =>
            [
                ...aaveV3Reserves
                    .filter((r) => r.supplied > 0 || r.debt > 0)
                    .map((r): OtherRow => ({
                        key: `aave-v3:${r.underlying}`,
                        platform: 'aave-v3',
                        primarySymbol: r.symbol,
                        primaryAddress: r.underlying,
                        suppliedAmount: r.supplied,
                        suppliedUsd: r.suppliedUsd,
                        debtAmount: r.debt,
                        debtUsd: r.debtUsd,
                        healthFactor: undefined
                    })),
                ...pairToRows(morpho.positions, 'morpho'),
                ...pairToRows(fluid.positions, 'fluid')
            ].sort((a, b) => b.suppliedUsd + b.debtUsd - (a.suppliedUsd + a.debtUsd)),
        [aaveV3Reserves, morpho.positions, fluid.positions]
    );

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
                    <h1 className={styles.heroTitle}>Your DeFi portfolio, beautifully clear.</h1>
                </Reveal>
                <Reveal delay={0.06}>
                    <p className={styles.heroSub}>
                        Connect your wallet to manage Aave v4 and track your Aave v3, Morpho and Fluid positions.
                    </p>
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

    if (account && totalCollateralUsd === 0 && totalDebtUsd === 0) {
        if (otherPlatforms.loading) return <DashboardSkeleton />;
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
                        value={totalNetWorthUsd}
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
                            sub="Aave v4"
                        />
                    </div>
                    <div className={styles.statCard}>
                        <StatTile
                            label="Health Factor"
                            value={
                                <span className={styles.healthBadgeRow}>
                                    <HealthBadge hf={overallHealthFactor} size="lg" />
                                </span>
                            }
                            sub="All platforms · worst case"
                        />
                    </div>
                    <div className={styles.statCard}>
                        <StatTile label="Available to Borrow" value={fmtUsd(account.availableBorrowsUsd)} sub="Aave v4" />
                    </div>
                </div>
            </Reveal>

            <Reveal delay={0.12}>
                <div className={styles.charts}>
                    <Card title="Health">
                        <HealthGauge hf={overallHealthFactor} />
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

            <Reveal delay={0.15}>
                <Card title="Platforms">
                    <PlatformBreakdown rows={platformRows} />
                </Card>
            </Reveal>

            {account.collateralUsd > 0 && (
                <Reveal delay={0.18}>
                    <Card title="Leverage simulator · loop vs hold">
                        <LoopSimulator account={account} reserves={reserves} />
                    </Card>
                </Reveal>
            )}

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

            <Reveal delay={0.3}>
                <Card title="Other platforms">
                    <OtherPositions rows={otherRows} />
                </Card>
            </Reveal>
        </div>
    );
};
