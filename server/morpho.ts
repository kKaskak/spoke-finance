import { MORPHO_API_URL } from '../shared/constants';
import type { PairMarket, PairPosition, PlatformSummary } from '../shared/types';

type MorphoAsset = { address: string; symbol: string; decimals: number; priceUsd: number | null };
type MorphoMarketState = {
    supplyAssetsUsd: number | null;
    borrowAssetsUsd: number | null;
    utilization: number | null;
    supplyApy: number | null;
    borrowApy: number | null;
};
type MorphoMarket = {
    marketId: string;
    lltv: string;
    irmAddress: string;
    oracle: { address: string };
    loanAsset: MorphoAsset;
    collateralAsset: MorphoAsset | null;
    state: MorphoMarketState | null;
};
// the API's BigInt scalar serializes as a JSON number when it fits a safe JS integer, a string otherwise
type MorphoPositionState = {
    supplyShares: string | number;
    supplyAssets: string | number;
    supplyAssetsUsd: number | null;
    borrowShares: string | number;
    borrowAssets: string | number;
    borrowAssetsUsd: number | null;
    collateral: string | number;
    collateralUsd: number | null;
};
type MorphoMarketPosition = { market: MorphoMarket; state: MorphoPositionState | null; healthFactor: number | null };

const gql = async <T>(document: string, variables: Record<string, unknown>): Promise<T> => {
    const res = await fetch(MORPHO_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: document, variables })
    });
    if (!res.ok) throw new Error(`morpho api ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    if (!json.data) throw new Error('morpho api: empty response');
    return json.data;
};

const MARKETS_QUERY = `
    query Markets($first: Int!) {
        markets(where: { chainId_in: [1] }, orderBy: SupplyAssetsUsd, orderDirection: Desc, first: $first) {
            items {
                marketId
                lltv
                irmAddress
                oracle { address }
                loanAsset { address symbol decimals priceUsd }
                collateralAsset { address symbol decimals priceUsd }
                state { supplyAssetsUsd borrowAssetsUsd utilization supplyApy borrowApy }
            }
        }
    }
`;

const POSITIONS_QUERY = `
    query Positions($address: String!) {
        userByAddress(chainId: 1, address: $address) {
            marketPositions {
                market {
                    marketId
                    lltv
                    irmAddress
                    oracle { address }
                    loanAsset { address symbol decimals priceUsd }
                    collateralAsset { address symbol decimals priceUsd }
                }
                state {
                    supplyShares
                    supplyAssets
                    supplyAssetsUsd
                    borrowShares
                    borrowAssets
                    borrowAssetsUsd
                    collateral
                    collateralUsd
                }
                healthFactor
            }
        }
    }
`;

// ponytail: caps the markets list to the top 40 by supply so the Markets page stays scannable; Morpho has thousands of permissionless markets
const MAX_MARKETS = 40;

const toMarket = (m: MorphoMarket): PairMarket | null => {
    if (!m.collateralAsset || !m.state) return null;
    return {
        id: m.marketId,
        supplySymbol: m.collateralAsset.symbol,
        supplyAddress: m.collateralAsset.address,
        supplyDecimals: m.collateralAsset.decimals,
        supplyPriceUsd: m.collateralAsset.priceUsd ?? 0,
        borrowSymbol: m.loanAsset.symbol,
        borrowAddress: m.loanAsset.address,
        borrowDecimals: m.loanAsset.decimals,
        borrowPriceUsd: m.loanAsset.priceUsd ?? 0,
        maxLtv: Number(m.lltv) / 1e18,
        supplyApr: m.state.supplyApy ?? 0,
        borrowApr: m.state.borrowApy ?? 0,
        utilization: m.state.utilization ?? 0,
        totalSuppliedUsd: m.state.supplyAssetsUsd ?? 0,
        totalDebtUsd: m.state.borrowAssetsUsd ?? 0,
        oracleAddress: m.oracle.address,
        irmAddress: m.irmAddress,
        lltvRaw: m.lltv
    };
};

let marketsCache: { at: number; data: PairMarket[] } | null = null;

export const getMarkets = async (): Promise<PairMarket[]> => {
    if (marketsCache && Date.now() - marketsCache.at < 60_000) return marketsCache.data;
    return loadMarkets();
};

const loadMarkets = async (): Promise<PairMarket[]> => {
    const data = await gql<{ markets: { items: MorphoMarket[] } }>(MARKETS_QUERY, { first: MAX_MARKETS });
    const markets = data.markets.items.map(toMarket).filter((m): m is PairMarket => m !== null);
    marketsCache = { at: Date.now(), data: markets };
    return markets;
};

const summaryCache = new Map<string, { at: number; data: PlatformSummary }>();

export const getSummary = async (address: string): Promise<PlatformSummary> => {
    const cached = summaryCache.get(address);
    if (cached && Date.now() - cached.at < 10_000) return cached.data;
    return loadSummary(address);
};

const loadSummary = async (address: string): Promise<PlatformSummary> => {
    const [markets, data] = await Promise.all([
        getMarkets(),
        gql<{ userByAddress: { marketPositions: MorphoMarketPosition[] } | null }>(POSITIONS_QUERY, { address })
    ]);

    const raw = data.userByAddress?.marketPositions ?? [];
    const positions: PairPosition[] = raw
        .filter((p) => p.market.collateralAsset && p.state)
        .map((p) => {
            const market = p.market;
            const state = p.state!;
            const collateralAsset = market.collateralAsset!;
            const hasCollateral = Number(state.collateral) > 0;
            const supplyAsset = hasCollateral ? collateralAsset : market.loanAsset;
            const suppliedUsd = hasCollateral ? state.collateralUsd ?? 0 : state.supplyAssetsUsd ?? 0;
            const supplied = hasCollateral
                ? Number(state.collateral) / 10 ** collateralAsset.decimals
                : Number(state.supplyAssets) / 10 ** market.loanAsset.decimals;
            const debtUsd = state.borrowAssetsUsd ?? 0;
            const debt = Number(state.borrowAssets) / 10 ** market.loanAsset.decimals;
            return {
                id: market.marketId,
                marketId: market.marketId,
                supplySymbol: supplyAsset.symbol,
                supplyAddress: supplyAsset.address,
                borrowSymbol: market.loanAsset.symbol,
                borrowAddress: market.loanAsset.address,
                supplied,
                suppliedUsd,
                debt,
                debtUsd,
                maxLtv: hasCollateral ? Number(market.lltv) / 1e18 : 0,
                healthFactor: debtUsd > 0 ? p.healthFactor : null,
                // the API's BigInt scalar serializes as a JSON number when small enough to fit safely, string otherwise; normalize so BigInt() reconstruction is exact either way
                collateralRaw: String(state.collateral),
                borrowSharesRaw: String(state.borrowShares),
                supplySharesRaw: String(state.supplyShares)
            };
        })
        .filter((p) => p.suppliedUsd > 0 || p.debtUsd > 0);

    const collateralUsd = positions.reduce((s, p) => s + p.suppliedUsd, 0);
    const debtUsd = positions.reduce((s, p) => s + p.debtUsd, 0);
    const withDebt = positions.filter((p): p is PairPosition & { healthFactor: number } => p.healthFactor !== null);
    const healthFactor = withDebt.length > 0 ? Math.min(...withDebt.map((p) => p.healthFactor)) : null;

    const summary: PlatformSummary = {
        platform: 'morpho',
        label: 'Morpho',
        collateralUsd,
        debtUsd,
        healthFactor,
        markets,
        positions
    };
    summaryCache.set(address, { at: Date.now(), data: summary });
    return summary;
};
