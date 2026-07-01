import { ethers } from 'ethers';
import { PRICE_DECIMALS, RAY, SPOKE_ADDRESS, VALUE_SCALE } from '../shared/constants';
import type { AccountSummary, PositionResponse, Reserve, ReserveWithUser } from '../shared/types';
import { erc20, hubContract, oracle, spoke } from './chain';
import { mapLimit, withRetry } from './util';

type RawReserve = {
    id: number;
    symbol: string;
    underlying: string;
    hub: string;
    assetId: number;
    decimals: number;
    collateralFactorBps: number;
    liquidationBonusBps: number;
    liquidationFeeBps: number;
    borrowable: boolean;
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
    const count = Number(await spoke.getReserveCount());
    const ids = Array.from({ length: count }, (_, i) => i);
    const data = await mapLimit(ids, 4, async (id) => {
        const r = await spoke.getReserve(id);
        const cfg = await spoke.getReserveConfig(id);
        const dyn = await spoke.getDynamicReserveConfig(id, r.dynamicConfigKey);
        const symbol = await erc20(r.underlying).symbol();
        return {
            id,
            symbol,
            underlying: r.underlying as string,
            hub: r.hub as string,
            assetId: Number(r.assetId),
            decimals: Number(r.decimals),
            collateralFactorBps: Number(dyn.collateralFactor),
            liquidationBonusBps: Number(dyn.maxLiquidationBonus),
            liquidationFeeBps: Number(dyn.liquidationFee),
            borrowable: cfg.borrowable as boolean,
            frozen: cfg.frozen as boolean,
            paused: cfg.paused as boolean
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
    const prices: bigint[] = await withRetry(() => oracle.getReservesPrices(raw.map((r) => r.id)));
    const data = await mapLimit(raw, 3, async (r, i) => {
        const supplied = await spoke.getReserveSuppliedAssets(r.id);
        const debt = await spoke.getReserveTotalDebt(r.id);
        const rate: bigint = await hubContract(r.hub).getAssetDrawnRate(r.assetId);
        const priceUsd = Number(prices[i]) / 10 ** PRICE_DECIMALS;
        const totalSupplied = num(supplied, r.decimals);
        const totalDebt = num(debt, r.decimals);
        const utilization = totalSupplied > 0 ? totalDebt / totalSupplied : 0;
        const borrowApr = Number(rate) / RAY;
        const collateralFactor = r.collateralFactorBps / 10000;
        return {
            id: r.id,
            symbol: r.symbol,
            underlying: r.underlying,
            decimals: r.decimals,
            priceUsd,
            collateralFactor,
            liquidationBonusBps: r.liquidationBonusBps,
            liquidationFeeBps: r.liquidationFeeBps,
            canBeCollateral: collateralFactor > 0,
            borrowable: r.borrowable,
            frozen: r.frozen,
            paused: r.paused,
            borrowApr,
            supplyApr: borrowApr * utilization,
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
    const acc = await withRetry(() => spoke.getUserAccountData(address));
    const collateralUsd = Number(acc.totalCollateralValue) / VALUE_SCALE;
    const debtUsd = Number(acc.totalDebtValueRay) / VALUE_SCALE / RAY;
    const avgCollateralFactor = Number(acc.avgCollateralFactor) / 1e18;
    const borrowPowerUsd = collateralUsd * avgCollateralFactor;

    const merged: ReserveWithUser[] = await mapLimit(reserves, 3, async (reserve) => {
        const token = erc20(reserve.underlying);
        const [suppliedRaw, debtRaw, status, balanceRaw, allowanceRaw] = await Promise.all([
            spoke.getUserSuppliedAssets(reserve.id, address),
            spoke.getUserTotalDebt(reserve.id, address),
            spoke.getUserReserveStatus(reserve.id, address),
            token.balanceOf(address),
            token.allowance(address, SPOKE_ADDRESS)
        ]);
        const supplied = num(suppliedRaw, reserve.decimals);
        const debt = num(debtRaw, reserve.decimals);
        const walletBalance = num(balanceRaw, reserve.decimals);
        return {
            ...reserve,
            supplied,
            suppliedUsd: supplied * reserve.priceUsd,
            debt,
            debtUsd: debt * reserve.priceUsd,
            isCollateral: status.isCollateral,
            isBorrowed: status.isBorrowed,
            walletBalance,
            walletBalanceUsd: walletBalance * reserve.priceUsd,
            allowance: num(allowanceRaw, reserve.decimals)
        };
    });

    const supplyInterest = merged.reduce((s, r) => s + r.suppliedUsd * r.supplyApr, 0);
    const borrowInterest = merged.reduce((s, r) => s + r.debtUsd * r.borrowApr, 0);
    const netWorthUsd = collateralUsd - debtUsd;

    const account: AccountSummary = {
        address,
        healthFactor: debtUsd > 0 ? Number(acc.healthFactor) / 1e18 : null,
        collateralUsd,
        debtUsd,
        borrowPowerUsd,
        availableBorrowsUsd: Math.max(0, borrowPowerUsd - debtUsd),
        avgCollateralFactor,
        netWorthUsd,
        netApr: netWorthUsd > 0 ? (supplyInterest - borrowInterest) / netWorthUsd : 0,
        riskPremiumBps: Number(acc.riskPremium)
    };

    const data = { account, reserves: merged };
    positionCache.set(address, { at: Date.now(), data });
    return data;
};
