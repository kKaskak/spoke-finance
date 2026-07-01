import { ethers } from 'ethers';
import { PRICE_DECIMALS, RAY, SPOKE_ADDRESS, VALUE_SCALE } from '../shared/constants';
import type { AccountSummary, PositionResponse, Reserve, ReserveWithUser } from '../shared/types';
import { erc20Iface, hubIface, oracle, spoke } from './chain';
import { multicall } from './multicall';
import { decodeSymbol, withRetry } from './util';

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

    const round1 = (await multicall(
        ids.flatMap((id) => [
            { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getReserve', args: [id] },
            { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getReserveConfig', args: [id] }
        ])
    )) as any[];

    const round2 = (await multicall(
        ids.flatMap((_, i) => {
            const r = round1[i * 2];
            return [
                { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getDynamicReserveConfig', args: [ids[i], r.dynamicConfigKey] },
                { target: r.underlying as string, iface: erc20Iface, method: 'symbol', decode: (d: string) => decodeSymbol(d, (r.underlying as string).slice(0, 6)) }
            ];
        })
    )) as any[];

    const data = ids.map((id, i) => {
        const r = round1[i * 2];
        const cfg = round1[i * 2 + 1];
        const dyn = round2[i * 2];
        return {
            id,
            symbol: round2[i * 2 + 1] as string,
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
    const res = (await multicall(
        raw.flatMap((r) => [
            { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getReserveSuppliedAssets', args: [r.id] },
            { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getReserveTotalDebt', args: [r.id] },
            { target: r.hub, iface: hubIface, method: 'getAssetDrawnRate', args: [r.assetId] }
        ])
    )) as bigint[];
    const data = raw.map((r, i) => {
        const supplied = res[i * 3];
        const debt = res[i * 3 + 1];
        const rate = res[i * 3 + 2];
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

    const res = (await multicall(
        reserves.flatMap((reserve) => [
            { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getUserSuppliedAssets', args: [reserve.id, address] },
            { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getUserTotalDebt', args: [reserve.id, address] },
            { target: SPOKE_ADDRESS, iface: spoke.interface, method: 'getUserReserveStatus', args: [reserve.id, address] },
            { target: reserve.underlying, iface: erc20Iface, method: 'balanceOf', args: [address] },
            { target: reserve.underlying, iface: erc20Iface, method: 'allowance', args: [address, SPOKE_ADDRESS] }
        ])
    )) as any[];
    const merged: ReserveWithUser[] = reserves.map((reserve, i) => {
        const base = i * 5;
        const supplied = num(res[base] as bigint, reserve.decimals);
        const debt = num(res[base + 1] as bigint, reserve.decimals);
        const status = res[base + 2];
        const walletBalance = num(res[base + 3] as bigint, reserve.decimals);
        return {
            ...reserve,
            supplied,
            suppliedUsd: supplied * reserve.priceUsd,
            debt,
            debtUsd: debt * reserve.priceUsd,
            isCollateral: status.isCollateral as boolean,
            isBorrowed: status.isBorrowed as boolean,
            walletBalance,
            walletBalanceUsd: walletBalance * reserve.priceUsd,
            allowance: num(res[base + 4] as bigint, reserve.decimals)
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
