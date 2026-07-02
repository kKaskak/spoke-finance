import { ethers } from 'ethers';
import { FLUID_NATIVE_ETH, PRICE_DECIMALS, WETH_ADDRESS } from '../shared/constants';
import type { PairMarket, PairPosition, PlatformSummary } from '../shared/types';
import { erc20Iface, getAaveV3Oracle, getFluidVaultResolver } from './chain';
import { multicall } from './multicall';
import { decodeSymbol, withRetry } from './util';

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

// value caches only: promises cached across requests get canceled by the Workers runtime
const metaCache = new Map<string, TokenMeta>();
const priceCache = new Map<string, number>();

const ensureTokenData = async (addresses: string[]) => {
    const needMeta = [...new Set(addresses.filter((a) => !isNativeEth(a) && !metaCache.has(a)))];
    const needPrice = [...new Set(addresses.map((a) => (isNativeEth(a) ? WETH_ADDRESS : a)).filter((a) => !priceCache.has(a)))];
    if (!needMeta.length && !needPrice.length) return;
    const oracle = getAaveV3Oracle();
    const res = await multicall([
        ...needMeta.flatMap((a) => [
            { target: a, iface: erc20Iface, method: 'symbol', soft: true, decode: (d: string) => decodeSymbol(d, a.slice(0, 6)) },
            { target: a, iface: erc20Iface, method: 'decimals' }
        ]),
        ...needPrice.map((a) => ({ target: oracle.target as string, iface: oracle.interface, method: 'getAssetPrice', args: [a], soft: true }))
    ]);
    needMeta.forEach((a, i) => metaCache.set(a, { symbol: (res[i * 2] as string) ?? a.slice(0, 6), decimals: Number(res[i * 2 + 1]) }));
    needPrice.forEach((a, i) => {
        const raw = res[needMeta.length * 2 + i];
        priceCache.set(a, raw === undefined ? 0 : Number(raw) / 10 ** PRICE_DECIMALS);
    });
};

const tokenMeta = (address: string): TokenMeta =>
    isNativeEth(address) ? { symbol: 'ETH', decimals: 18 } : metaCache.get(address)!;
const priceUsd = (address: string): number => priceCache.get(isNativeEth(address) ? WETH_ADDRESS : address) ?? 0;

const isSimpleVault = (v: VaultEntireData) => !v.isSmartCol && !v.isSmartDebt;

let marketsCache: { at: number; data: PairMarket[] } | null = null;
let vaultsCache: { at: number; data: VaultEntireData[] } | null = null;

const loadVaults = async (): Promise<VaultEntireData[]> => {
    if (vaultsCache && Date.now() - vaultsCache.at < 60_000) return vaultsCache.data;
    const data: VaultEntireData[] = await withRetry(() => getFluidVaultResolver().getVaultsEntireData());
    vaultsCache = { at: Date.now(), data };
    return data;
};

export const getMarkets = async (): Promise<PairMarket[]> => {
    if (marketsCache && Date.now() - marketsCache.at < 60_000) return marketsCache.data;
    return buildMarkets().catch((e) => { if (marketsCache) return marketsCache.data; throw e; });
};

const buildMarkets = async (): Promise<PairMarket[]> => {
    const vaults = (await loadVaults()).filter(isSimpleVault);
    await ensureTokenData(vaults.flatMap((v) => [v.constantVariables.supplyToken.token0, v.constantVariables.borrowToken.token0]));
    const markets = vaults.map((v): PairMarket => {
        const supplyToken = v.constantVariables.supplyToken.token0;
        const borrowToken = v.constantVariables.borrowToken.token0;
        const supplyMeta = tokenMeta(supplyToken);
        const borrowMeta = tokenMeta(borrowToken);
        const supplyPrice = priceUsd(supplyToken);
        const borrowPrice = priceUsd(borrowToken);
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

export const getSummary = async (address: string): Promise<PlatformSummary> => {
    const cached = summaryCache.get(address);
    if (cached && Date.now() - cached.at < 10_000) return cached.data;
    return loadSummary(address).catch((e) => { if (cached) return cached.data; throw e; });
};

const loadSummary = async (address: string): Promise<PlatformSummary> => {
    const [markets, [userPositions, vaultsData]] = await Promise.all([
        getMarkets(),
        withRetry(() => getFluidVaultResolver().positionsByUser(address)) as Promise<[UserPosition[], VaultEntireData[]]>
    ]);

    const rows = userPositions
        .map((position, i) => ({ position, vault: vaultsData[i] }))
        .filter(({ position, vault }) => !position.isLiquidated && isSimpleVault(vault));

    await ensureTokenData(rows.flatMap(({ vault }) => [vault.constantVariables.supplyToken.token0, vault.constantVariables.borrowToken.token0]));
    const positions: PairPosition[] = rows.map(({ position, vault }): PairPosition => {
        const supplyToken = vault.constantVariables.supplyToken.token0;
        const borrowToken = vault.constantVariables.borrowToken.token0;
        const supplyMeta = tokenMeta(supplyToken);
        const borrowMeta = tokenMeta(borrowToken);
        const supplyPrice = priceUsd(supplyToken);
        const borrowPrice = priceUsd(borrowToken);
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
