import { ethers } from 'ethers';
import { FLUID_NATIVE_ETH, PRICE_DECIMALS, WETH_ADDRESS } from '../shared/constants';
import type { PairMarket, PairPosition, PlatformSummary } from '../shared/types';
import { erc20, getAaveV3Oracle, getFluidVaultResolver, getProvider } from './chain';
import { mapLimit, resilientSymbol, withRetry } from './util';

const isNativeEth = (address: string) => address.toLowerCase() === FLUID_NATIVE_ETH.toLowerCase();

type VaultEntireData = {
    vault: string;
    isSmartCol: boolean;
    isSmartDebt: boolean;
    constantVariables: {
        supplyToken: { token0: string };
        borrowToken: { token0: string };
    };
    configs: {
        collateralFactor: bigint;
        liquidationThreshold: bigint;
    };
    exchangePricesAndRates: {
        supplyRateVault: bigint;
        borrowRateVault: bigint;
    };
    totalSupplyAndBorrow: {
        totalSupplyVault: bigint;
        totalBorrowVault: bigint;
    };
};

type UserPosition = {
    nftId: bigint;
    isLiquidated: boolean;
    supply: bigint;
    borrow: bigint;
};

type TokenMeta = { symbol: string; decimals: number };

const metaCache = new Map<string, Promise<TokenMeta>>();
const tokenMeta = (address: string): Promise<TokenMeta> => {
    if (isNativeEth(address)) return Promise.resolve({ symbol: 'ETH', decimals: 18 });
    let p = metaCache.get(address);
    if (!p) {
        const token = erc20(address);
        p = Promise.all([resilientSymbol(getProvider(), address), withRetry(() => token.decimals())]).then(
            ([symbol, decimals]) => ({ symbol, decimals: Number(decimals) })
        );
        metaCache.set(address, p);
    }
    return p;
};

const priceCache = new Map<string, Promise<number>>();
const priceUsd = (address: string): Promise<number> => {
    const lookup = isNativeEth(address) ? WETH_ADDRESS : address;
    let p = priceCache.get(lookup);
    if (!p) {
        p = withRetry(() => getAaveV3Oracle().getAssetPrice(lookup))
            .then((raw: bigint) => Number(raw) / 10 ** PRICE_DECIMALS)
            .catch(() => 0);
        priceCache.set(lookup, p);
    }
    return p;
};

const isSimpleVault = (v: VaultEntireData) => !v.isSmartCol && !v.isSmartDebt;

let marketsCache: { at: number; data: PairMarket[] } | null = null;
let marketsInflight: Promise<PairMarket[]> | null = null;
let vaultsCache: { at: number; data: VaultEntireData[] } | null = null;

const loadVaults = async (): Promise<VaultEntireData[]> => {
    if (vaultsCache && Date.now() - vaultsCache.at < 60_000) return vaultsCache.data;
    const data: VaultEntireData[] = await withRetry(() => getFluidVaultResolver().getVaultsEntireData());
    vaultsCache = { at: Date.now(), data };
    return data;
};

export const getMarkets = async (): Promise<PairMarket[]> => {
    if (marketsCache && Date.now() - marketsCache.at < 60_000) return marketsCache.data;
    if (marketsInflight) return marketsInflight;
    marketsInflight = buildMarkets();
    try {
        return await marketsInflight;
    } finally {
        marketsInflight = null;
    }
};

const buildMarkets = async (): Promise<PairMarket[]> => {
    const vaults = (await loadVaults()).filter(isSimpleVault);
    const markets = await mapLimit(vaults, 5, async (v): Promise<PairMarket> => {
        const supplyToken = v.constantVariables.supplyToken.token0;
        const borrowToken = v.constantVariables.borrowToken.token0;
        const [supplyMeta, borrowMeta, supplyPrice, borrowPrice] = await Promise.all([
            tokenMeta(supplyToken),
            tokenMeta(borrowToken),
            priceUsd(supplyToken),
            priceUsd(borrowToken)
        ]);
        const totalSuppliedUsd = Number(ethers.formatUnits(v.totalSupplyAndBorrow.totalSupplyVault, supplyMeta.decimals)) * supplyPrice;
        const totalDebtUsd = Number(ethers.formatUnits(v.totalSupplyAndBorrow.totalBorrowVault, borrowMeta.decimals)) * borrowPrice;
        return {
            id: v.vault,
            supplySymbol: supplyMeta.symbol,
            supplyAddress: supplyToken,
            supplyDecimals: supplyMeta.decimals,
            supplyPriceUsd: supplyPrice,
            borrowSymbol: borrowMeta.symbol,
            borrowAddress: borrowToken,
            borrowDecimals: borrowMeta.decimals,
            borrowPriceUsd: borrowPrice,
            maxLtv: Number(v.configs.collateralFactor) / 10000,
            supplyApr: Number(v.exchangePricesAndRates.supplyRateVault) / 10000,
            borrowApr: Number(v.exchangePricesAndRates.borrowRateVault) / 10000,
            utilization: totalSuppliedUsd > 0 ? totalDebtUsd / totalSuppliedUsd : 0,
            totalSuppliedUsd,
            totalDebtUsd
        };
    });
    marketsCache = { at: Date.now(), data: markets };
    return markets;
};

const summaryCache = new Map<string, { at: number; data: PlatformSummary }>();
const summaryInflight = new Map<string, Promise<PlatformSummary>>();

export const getSummary = async (address: string): Promise<PlatformSummary> => {
    const cached = summaryCache.get(address);
    if (cached && Date.now() - cached.at < 10_000) return cached.data;
    const existing = summaryInflight.get(address);
    if (existing) return existing;
    const promise = loadSummary(address);
    summaryInflight.set(address, promise);
    try {
        return await promise;
    } finally {
        summaryInflight.delete(address);
    }
};

const loadSummary = async (address: string): Promise<PlatformSummary> => {
    const [markets, [userPositions, vaultsData]] = await Promise.all([
        getMarkets(),
        withRetry(() => getFluidVaultResolver().positionsByUser(address)) as Promise<[UserPosition[], VaultEntireData[]]>
    ]);

    const rows = userPositions
        .map((position, i) => ({ position, vault: vaultsData[i] }))
        .filter(({ position, vault }) => !position.isLiquidated && isSimpleVault(vault));

    const positions: PairPosition[] = await mapLimit(rows, 5, async ({ position, vault }): Promise<PairPosition> => {
        const supplyToken = vault.constantVariables.supplyToken.token0;
        const borrowToken = vault.constantVariables.borrowToken.token0;
        const [supplyMeta, borrowMeta, supplyPrice, borrowPrice] = await Promise.all([
            tokenMeta(supplyToken),
            tokenMeta(borrowToken),
            priceUsd(supplyToken),
            priceUsd(borrowToken)
        ]);
        const supplied = Number(ethers.formatUnits(position.supply, supplyMeta.decimals));
        const debt = Number(ethers.formatUnits(position.borrow, borrowMeta.decimals));
        const suppliedUsd = supplied * supplyPrice;
        const debtUsd = debt * borrowPrice;
        const liquidationThreshold = Number(vault.configs.liquidationThreshold) / 10000;
        const healthFactor = debtUsd > 0 ? (suppliedUsd * liquidationThreshold) / debtUsd : null;
        return {
            id: position.nftId.toString(),
            marketId: vault.vault,
            supplySymbol: supplyMeta.symbol,
            supplyAddress: supplyToken,
            borrowSymbol: borrowMeta.symbol,
            borrowAddress: borrowToken,
            supplied,
            suppliedUsd,
            debt,
            debtUsd,
            maxLtv: Number(vault.configs.collateralFactor) / 10000,
            healthFactor
        };
    });

    const collateralUsd = positions.reduce((s, p) => s + p.suppliedUsd, 0);
    const debtUsd = positions.reduce((s, p) => s + p.debtUsd, 0);
    const withDebt = positions.filter((p): p is PairPosition & { healthFactor: number } => p.healthFactor !== null);
    const healthFactor = withDebt.length > 0 ? Math.min(...withDebt.map((p) => p.healthFactor)) : null;

    const summary: PlatformSummary = {
        platform: 'fluid',
        label: 'Fluid',
        collateralUsd,
        debtUsd,
        healthFactor,
        markets,
        positions
    };
    summaryCache.set(address, { at: Date.now(), data: summary });
    return summary;
};
