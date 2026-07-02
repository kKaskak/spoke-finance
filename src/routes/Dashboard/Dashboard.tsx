import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button/Button';
import { Card } from '@/components/Card/Card';
import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import { StatTile } from '@/components/StatTile/StatTile';
import { WalletButton } from '@/components/WalletButton/WalletButton';
import { useApp } from '@/lib/app';
import { fmtPct, fmtUsd } from '@/lib/format';
import { isWstEth, useLidoApr } from '@/lib/lido';
import { AnimatedNumber, Reveal } from '@/lib/motion';
import type { PlatformKey } from '@/lib/platform';
import type { PairMarket, PairPosition, ReserveWithUser } from '@shared/types';
import { AllocationDonut, type Slice } from './components/AllocationDonut';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { HealthGauge } from './components/HealthGauge';
import { LoopSimulator } from './components/LoopSimulator';
import { type PlatformRow, PlatformBreakdown } from './components/PlatformBreakdown';
import { BorrowList, type BorrowItem, SupplyList, type SupplyItem } from './components/PositionList';
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

const pairMarketFor = (position: PairPosition, markets: PairMarket[]): PairMarket | undefined =>
    markets.find((m) => m.id === position.marketId);

const pooledNetInterest = (reserves: ReserveWithUser[]): number =>
    reserves.reduce((s, r) => s + r.suppliedUsd * r.supplyApr - r.debtUsd * r.borrowApr, 0);

// wstETH accrues staking yield via its exchange rate, on top of the lending APR
const wstEthNetExposureUsd = (reserves: ReserveWithUser[], positions: PairPosition[]): number =>
    reserves.reduce((s, r) => s + (isWstEth(r.symbol) ? r.suppliedUsd - r.debtUsd : 0), 0) +
    positions.reduce(
        (s, p) => s + (isWstEth(p.supplySymbol) ? p.suppliedUsd : 0) - (isWstEth(p.borrowSymbol) ? p.debtUsd : 0),
        0
    );

const pairNetInterest = (positions: PairPosition[], markets: PairMarket[]): number =>
    positions.reduce((s, p) => {
        const m = pairMarketFor(p, markets);
        return m ? s + p.suppliedUsd * m.supplyApr - p.debtUsd * m.borrowApr : s;
    }, 0);

const pairAprEntries = (positions: PairPosition[], markets: PairMarket[]): { apr: number; usd: number }[] =>
    positions
        .filter((p) => p.debtUsd > 0)
        .map((p) => {
            const m = pairMarketFor(p, markets);
            return m ? { apr: m.borrowApr, usd: p.debtUsd } : null;
        })
        .filter((e): e is { apr: number; usd: number } => e !== null);

const debtWeightedMedianApr = (entries: { apr: number; usd: number }[]): number | null => {
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => a.apr - b.apr);
    const half = sorted.reduce((s, e) => s + e.usd, 0) / 2;
    let acc = 0;
    for (const e of sorted) {
        acc += e.usd;
        if (acc >= half) return e.apr;
    }
    return sorted[sorted.length - 1].apr;
};

export const Dashboard = () => {
    const { portfolio, otherPlatforms } = useApp();
    const { account, reserves, loading, error, connected } = portfolio;
    const { aaveV3Reserves, aaveV3Account, morpho, fluid } = otherPlatforms;
    const lidoApr = useLidoApr();

    const supplyItems: SupplyItem[] = useMemo(
        () => [
            ...reserves.filter((r) => r.supplied > 0).map((reserve): SupplyItem => ({ kind: 'pooled', platform: 'aave-v4', reserve })),
            ...aaveV3Reserves.filter((r) => r.supplied > 0).map((reserve): SupplyItem => ({ kind: 'pooled', platform: 'aave-v3', reserve })),
            ...morpho.positions
                .filter((p) => p.suppliedUsd > 0)
                .map((position): SupplyItem | null => {
                    const market = pairMarketFor(position, morpho.markets);
                    return market ? { kind: 'pair', platform: 'morpho', market, position } : null;
                })
                .filter((i): i is SupplyItem => i !== null),
            ...fluid.positions
                .filter((p) => p.suppliedUsd > 0)
                .map((position): SupplyItem | null => {
                    const market = pairMarketFor(position, fluid.markets);
                    return market ? { kind: 'pair', platform: 'fluid', market, position } : null;
                })
                .filter((i): i is SupplyItem => i !== null)
        ],
        [reserves, aaveV3Reserves, morpho, fluid]
    );

    const borrowItems: BorrowItem[] = useMemo(
        () => [
            ...reserves.filter((r) => r.debt > 0).map((reserve): BorrowItem => ({ kind: 'pooled', platform: 'aave-v4', reserve })),
            ...aaveV3Reserves.filter((r) => r.debt > 0).map((reserve): BorrowItem => ({ kind: 'pooled', platform: 'aave-v3', reserve })),
            ...morpho.positions
                .filter((p) => p.debtUsd > 0)
                .map((position): BorrowItem | null => {
                    const market = pairMarketFor(position, morpho.markets);
                    return market ? { kind: 'pair', platform: 'morpho', market, position } : null;
                })
                .filter((i): i is BorrowItem => i !== null),
            ...fluid.positions
                .filter((p) => p.debtUsd > 0)
                .map((position): BorrowItem | null => {
                    const market = pairMarketFor(position, fluid.markets);
                    return market ? { kind: 'pair', platform: 'fluid', market, position } : null;
                })
                .filter((i): i is BorrowItem => i !== null)
        ],
        [reserves, aaveV3Reserves, morpho, fluid]
    );

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
    const totalAvailableBorrowsUsd = platformRows.reduce((s, p) => s + p.availableBorrowsUsd, 0);
    const platformHfs = platformRows.map((p) => p.healthFactor).filter((hf): hf is number => hf !== null);
    const overallHealthFactor = platformHfs.length > 0 ? Math.min(...platformHfs) : null;
    const totalNetInterest =
        pooledNetInterest(reserves) +
        pooledNetInterest(aaveV3Reserves) +
        pairNetInterest(morpho.positions, morpho.markets) +
        pairNetInterest(fluid.positions, fluid.markets) +
        wstEthNetExposureUsd([...reserves, ...aaveV3Reserves], [...morpho.positions, ...fluid.positions]) * lidoApr;
    const overallNetApr = totalNetWorthUsd > 0 ? totalNetInterest / totalNetWorthUsd : 0;

    const market = useMemo(() => {
        const pooled = [...reserves, ...aaveV3Reserves];
        const pairs = [...morpho.markets, ...fluid.markets];
        return {
            size: pooled.reduce((s, r) => s + r.totalSuppliedUsd, 0) + pairs.reduce((s, m) => s + m.totalSuppliedUsd, 0),
            borrowed: pooled.reduce((s, r) => s + r.totalDebtUsd, 0) + pairs.reduce((s, m) => s + m.totalDebtUsd, 0),
            markets: pooled.length + pairs.length
        };
    }, [reserves, aaveV3Reserves, morpho.markets, fluid.markets]);

    if (!connected) {
        const marketReady = market.markets > 0;
        return (
            <div className={styles.hero}>
                <Reveal>
                    <h1 className={styles.heroTitle}>Your DeFi portfolio, beautifully clear.</h1>
                </Reveal>
                <Reveal delay={0.06}>
                    <p className={styles.heroSub}>
                        Connect your wallet to manage your positions across Aave v4, Aave v3, Morpho and Fluid.
                    </p>
                </Reveal>
                <Reveal delay={0.12} className={styles.heroCta}>
                    <WalletButton />
                </Reveal>
                <Reveal delay={0.18} className={styles.marketStrip}>
                    <div className={styles.marketStat}>
                        <StatTile
                            label="Total Market Size"
                            value={marketReady ? fmtUsd(market.size, true) : <Skeleton width={90} height={24} />}
                            sub="All platforms"
                        />
                    </div>
                    <div className={styles.marketStat}>
                        <StatTile
                            label="Total Borrowed"
                            value={marketReady ? fmtUsd(market.borrowed, true) : <Skeleton width={90} height={24} />}
                            sub="All platforms"
                        />
                    </div>
                    <div className={styles.marketStat}>
                        <StatTile
                            label="Markets"
                            value={marketReady ? market.markets : <Skeleton width={40} height={24} />}
                            sub="All platforms"
                        />
                    </div>
                </Reveal>
            </div>
        );
    }

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

    if (!account) return <DashboardSkeleton />;

    const netAprAccent = overallNetApr >= 0 ? 'supply' : 'borrow';
    const netAprSign = overallNetApr >= 0 ? '+' : '−';

    const borrowAprEntries = [
        ...reserves.filter((r) => r.debtUsd > 0).map((r) => ({ apr: r.borrowApr, usd: r.debtUsd })),
        ...aaveV3Reserves.filter((r) => r.debtUsd > 0).map((r) => ({ apr: r.borrowApr, usd: r.debtUsd })),
        ...pairAprEntries(morpho.positions, morpho.markets),
        ...pairAprEntries(fluid.positions, fluid.markets)
    ];
    const fallbackApr =
        reserves.find((r) => r.symbol === 'GHO')?.borrowApr ??
        reserves.find((r) => ['USDC', 'USDT', 'DAI'].includes(r.symbol))?.borrowApr ??
        0.035;
    const simBorrowApr = debtWeightedMedianApr(borrowAprEntries) ?? fallbackApr;
    const cfWeighted =
        account.avgCollateralFactor * account.collateralUsd +
        (aaveV3Account ? aaveV3Account.avgCollateralFactor * aaveV3Account.collateralUsd : 0) +
        morpho.positions.reduce((s, p) => s + p.suppliedUsd * p.maxLtv, 0) +
        fluid.positions.reduce((s, p) => s + p.suppliedUsd * p.maxLtv, 0);
    const simCollateralFactor = totalCollateralUsd > 0 ? cfWeighted / totalCollateralUsd : 0;

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
                            value={`${netAprSign}${fmtPct(Math.abs(overallNetApr))}`}
                            accent={netAprAccent}
                            sub="All platforms"
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
                        <StatTile label="Available to Borrow" value={fmtUsd(totalAvailableBorrowsUsd)} sub="All platforms" />
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

            {totalCollateralUsd > 0 && (
                <Reveal delay={0.18}>
                    <Card title="Leverage simulator · loop vs hold">
                        <LoopSimulator
                            netWorthUsd={totalNetWorthUsd}
                            healthFactor={overallHealthFactor}
                            collateralFactor={simCollateralFactor}
                            borrowApr={simBorrowApr}
                        />
                    </Card>
                </Reveal>
            )}

            <Reveal delay={0.18}>
                <Card title="Your supplies">
                    {supplyItems.length === 0 ? (
                        <p className={styles.muted}>You have no supplied assets.</p>
                    ) : (
                        <SupplyList items={supplyItems} account={account.address} />
                    )}
                </Card>
            </Reveal>

            <Reveal delay={0.24}>
                <Card title="Your borrows">
                    {borrowItems.length === 0 ? (
                        <p className={styles.muted}>You have no borrowed assets.</p>
                    ) : (
                        <BorrowList items={borrowItems} account={account.address} />
                    )}
                </Card>
            </Reveal>
        </div>
    );
};
