import { ethers } from 'ethers';
import { PRICE_DECIMALS } from '../shared/constants';
import type { AccountSummary, PositionResponse, Reserve, ReserveWithUser } from '../shared/types';
import { aaveV3DataProvider, aaveV3Oracle, aaveV3Pool, erc20, provider } from './chain';
import { mapLimit, resilientSymbol, withRetry } from './util';

type RawReserve = {
    id: number;
    symbol: string;
    underlying: string;
    decimals: number;
    ltvBps: number;
    liquidationThresholdBps: number;
    liquidationBonusBps: number;
    borrowable: boolean;
    canBeCollateral: boolean;
    frozen: boolean;
    paused: boolean;
};

const num = (value: bigint, decimals: number) => Number(ethers.formatUnits(value, decimals));

let rawCache: { at: number; data: RawReserve[] } | null = null;
let reservesCache: { at: number; data: Reserve[] } | null = null;
let reservesInflight: Promise<Reserve[]> | null = null;
const positionCache = new Map<string, { at: number; data: PositionResponse }>();
const positionInflight = new Map<string, Promise<PositionResponse>>();

const loadRawReserves = async (): Promise<RawReserve[]> => {
    if (rawCache && Date.now() - rawCache.at < 60_000) return rawCache.data;
    const list: string[] = await withRetry(() => aaveV3Pool.getReservesList());
    const data = await mapLimit(list, 4, async (underlying, id) => {
        const cfg = await aaveV3DataProvider.getReserveConfigurationData(underlying);
        const isActive = cfg.isActive as boolean;
        const paused: boolean = await aaveV3DataProvider.getPaused(underlying);
        const symbol = await resilientSymbol(provider, underlying);
        return {
            id,
            symbol,
            underlying,
            decimals: Number(cfg.decimals),
            ltvBps: Number(cfg.ltv),
            liquidationThresholdBps: Number(cfg.liquidationThreshold),
            liquidationBonusBps: Number(cfg.liquidationBonus) - 10000,
            borrowable: cfg.borrowingEnabled as boolean,
            canBeCollateral: cfg.usageAsCollateralEnabled as boolean,
            frozen: cfg.isFrozen as boolean,
            paused: paused || !isActive
        };
    });
    rawCache = { at: Date.now(), data };
    return data;
};

export const getReserves = async (): Promise<Reserve[]> => {
    if (reservesCache && Date.now() - reservesCache.at < 15_000) return reservesCache.data;
    if (reservesInflight) return reservesInflight;
    reservesInflight = loadReserves();
    try {
        return await reservesInflight;
    } finally {
        reservesInflight = null;
    }
};

const loadReserves = async (): Promise<Reserve[]> => {
    const raw = await loadRawReserves();
    const data = await mapLimit(raw, 3, async (r) => {
        const [reserveData, priceRaw]: [
            { totalAToken: bigint; totalVariableDebt: bigint; liquidityRate: bigint; variableBorrowRate: bigint },
            bigint
        ] = await Promise.all([
            withRetry(() => aaveV3DataProvider.getReserveData(r.underlying)),
            withRetry(() => aaveV3Oracle.getAssetPrice(r.underlying))
        ]);
        const priceUsd = Number(priceRaw) / 10 ** PRICE_DECIMALS;
        const totalSupplied = num(reserveData.totalAToken, r.decimals);
        const totalDebt = num(reserveData.totalVariableDebt, r.decimals);
        const utilization = totalSupplied > 0 ? totalDebt / totalSupplied : 0;
        const borrowApr = Number(reserveData.variableBorrowRate) / 1e27;
        const supplyApr = Number(reserveData.liquidityRate) / 1e27;
        return {
            id: r.id,
            symbol: r.symbol,
            underlying: r.underlying,
            decimals: r.decimals,
            priceUsd,
            collateralFactor: r.ltvBps / 10000,
            liquidationBonusBps: r.liquidationBonusBps,
            liquidationFeeBps: 0,
            canBeCollateral: r.canBeCollateral,
            borrowable: r.borrowable,
            frozen: r.frozen,
            paused: r.paused,
            borrowApr,
            supplyApr,
            utilization,
            totalSupplied,
            totalSuppliedUsd: totalSupplied * priceUsd,
            totalDebt,
            totalDebtUsd: totalDebt * priceUsd
        };
    });
    reservesCache = { at: Date.now(), data };
    return data;
};

export const getPosition = async (address: string): Promise<PositionResponse> => {
    const cached = positionCache.get(address);
    if (cached && Date.now() - cached.at < 10_000) return cached.data;
    const existing = positionInflight.get(address);
    if (existing) return existing;
    const promise = loadPosition(address);
    positionInflight.set(address, promise);
    try {
        return await promise;
    } finally {
        positionInflight.delete(address);
    }
};

const loadPosition = async (address: string): Promise<PositionResponse> => {
    const reserves = await getReserves();
    const acc = await withRetry(() => aaveV3Pool.getUserAccountData(address));
    const collateralUsd = Number(acc.totalCollateralBase) / 10 ** PRICE_DECIMALS;
    const debtUsd = Number(acc.totalDebtBase) / 10 ** PRICE_DECIMALS;
    const availableBorrowsUsd = Number(acc.availableBorrowsBase) / 10 ** PRICE_DECIMALS;
    const avgCollateralFactor = Number(acc.ltv) / 10000;
    const maxHf = ethers.MaxUint256;

    const merged: ReserveWithUser[] = await mapLimit(reserves, 3, async (reserve) => {
        const token = erc20(reserve.underlying);
        const [userData, balanceRaw] = await Promise.all([
            aaveV3DataProvider.getUserReserveData(reserve.underlying, address),
            token.balanceOf(address)
        ]);
        const supplied = num(userData.currentATokenBalance, reserve.decimals);
        const debt = num(userData.currentVariableDebt, reserve.decimals);
        const walletBalance = num(balanceRaw, reserve.decimals);
        return {
            ...reserve,
            supplied,
            suppliedUsd: supplied * reserve.priceUsd,
            debt,
            debtUsd: debt * reserve.priceUsd,
            isCollateral: userData.usageAsCollateralEnabled as boolean,
            isBorrowed: debt > 0,
            walletBalance,
            walletBalanceUsd: walletBalance * reserve.priceUsd,
            allowance: 0
        };
    });

    const supplyInterest = merged.reduce((s, r) => s + r.suppliedUsd * r.supplyApr, 0);
    const borrowInterest = merged.reduce((s, r) => s + r.debtUsd * r.borrowApr, 0);
    const netWorthUsd = collateralUsd - debtUsd;

    const account: AccountSummary = {
        address,
        healthFactor: acc.healthFactor === maxHf ? null : Number(acc.healthFactor) / 1e18,
        collateralUsd,
        debtUsd,
        borrowPowerUsd: collateralUsd * avgCollateralFactor,
        availableBorrowsUsd,
        avgCollateralFactor,
        netWorthUsd,
        netApr: netWorthUsd > 0 ? (supplyInterest - borrowInterest) / netWorthUsd : 0,
        riskPremiumBps: 0
    };

    const data = { account, reserves: merged };
    positionCache.set(address, { at: Date.now(), data });
    return data;
};
