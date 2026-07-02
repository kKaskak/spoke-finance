import { ethers } from 'ethers';
import { PRICE_DECIMALS } from '../shared/constants';
import type { AccountSummary, PositionResponse, Reserve, ReserveWithUser } from '../shared/types';
import { erc20Iface, getAaveV3DataProvider, getAaveV3Oracle, getAaveV3Pool } from './chain';
import { multicall } from './multicall';
import { decodeSymbol, withRetry } from './util';

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
const positionCache = new Map<string, { at: number; data: PositionResponse }>();

const loadRawReserves = async (): Promise<RawReserve[]> => {
    if (rawCache && Date.now() - rawCache.at < 60_000) return rawCache.data;
    const aaveV3DataProvider = getAaveV3DataProvider();
    const list: string[] = await withRetry(() => getAaveV3Pool().getReservesList());
    const dp = aaveV3DataProvider.target as string;
    const res = (await multicall(
        list.flatMap((underlying) => [
            { target: dp, iface: aaveV3DataProvider.interface, method: 'getReserveConfigurationData', args: [underlying] },
            { target: dp, iface: aaveV3DataProvider.interface, method: 'getPaused', args: [underlying] },
            { target: underlying, iface: erc20Iface, method: 'symbol', decode: (d: string) => decodeSymbol(d, underlying.slice(0, 6)) }
        ])
    )) as any[];
    const data = list.map((underlying, id) => {
        const cfg = res[id * 3];
        const isActive = cfg.isActive as boolean;
        const paused = res[id * 3 + 1] as boolean;
        return {
            id,
            symbol: res[id * 3 + 2] as string,
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
    return loadReserves().catch((e) => { if (reservesCache) return reservesCache.data; throw e; });
};

const loadReserves = async (): Promise<Reserve[]> => {
    const raw = await loadRawReserves();
    const aaveV3DataProvider = getAaveV3DataProvider();
    const aaveV3Oracle = getAaveV3Oracle();
    const dp = aaveV3DataProvider.target as string;
    const oracleAddr = aaveV3Oracle.target as string;
    const res = (await multicall(
        raw.flatMap((r) => [
            { target: dp, iface: aaveV3DataProvider.interface, method: 'getReserveData', args: [r.underlying] },
            { target: oracleAddr, iface: aaveV3Oracle.interface, method: 'getAssetPrice', args: [r.underlying] }
        ])
    )) as any[];
    const data = raw.map((r, i) => {
        const reserveData = res[i * 2];
        const priceUsd = Number(res[i * 2 + 1] as bigint) / 10 ** PRICE_DECIMALS;
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
    return loadPosition(address).catch((e) => { if (cached) return cached.data; throw e; });
};

const loadPosition = async (address: string): Promise<PositionResponse> => {
    const reserves = await getReserves();
    const acc = await withRetry(() => getAaveV3Pool().getUserAccountData(address));
    const collateralUsd = Number(acc.totalCollateralBase) / 10 ** PRICE_DECIMALS;
    const debtUsd = Number(acc.totalDebtBase) / 10 ** PRICE_DECIMALS;
    const availableBorrowsUsd = Number(acc.availableBorrowsBase) / 10 ** PRICE_DECIMALS;
    const avgCollateralFactor = Number(acc.ltv) / 10000;
    const maxHf = ethers.MaxUint256;

    const aaveV3DataProvider = getAaveV3DataProvider();
    const dp = aaveV3DataProvider.target as string;
    const res = (await multicall(
        reserves.flatMap((reserve) => [
            { target: dp, iface: aaveV3DataProvider.interface, method: 'getUserReserveData', args: [reserve.underlying, address] },
            { target: reserve.underlying, iface: erc20Iface, method: 'balanceOf', args: [address] }
        ])
    )) as any[];
    const merged: ReserveWithUser[] = reserves.map((reserve, i) => {
        const userData = res[i * 2];
        const supplied = num(userData.currentATokenBalance, reserve.decimals);
        const debt = num(userData.currentVariableDebt, reserve.decimals);
        const walletBalance = num(res[i * 2 + 1] as bigint, reserve.decimals);
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
