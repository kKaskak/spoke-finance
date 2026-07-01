import type { AccountSummary, ActionKind, PairMarket, PairPosition, ReserveWithUser } from '@shared/types';

export type Projection = {
    healthFactor: number | null;
    collateralUsd: number;
    debtUsd: number;
    borrowPowerUsd: number;
    availableBorrowsUsd: number;
    netWorthUsd: number;
};

const hf = (borrowPower: number, debt: number): number | null => (debt > 0 ? borrowPower / debt : null);

export const projectAction = (
    account: AccountSummary,
    reserve: ReserveWithUser,
    kind: ActionKind,
    amount: number
): Projection => {
    const amountUsd = amount * reserve.priceUsd;
    const cf = reserve.collateralFactor;
    let { collateralUsd, debtUsd, borrowPowerUsd } = account;
    const countsAsCollateral = reserve.canBeCollateral && (reserve.isCollateral || reserve.supplied === 0);

    if (kind === 'supply') {
        collateralUsd += amountUsd;
        if (countsAsCollateral) borrowPowerUsd += amountUsd * cf;
    } else if (kind === 'withdraw') {
        collateralUsd = Math.max(0, collateralUsd - amountUsd);
        if (reserve.isCollateral) borrowPowerUsd = Math.max(0, borrowPowerUsd - amountUsd * cf);
    } else if (kind === 'borrow') {
        debtUsd += amountUsd;
    } else {
        debtUsd = Math.max(0, debtUsd - amountUsd);
    }

    return {
        healthFactor: hf(borrowPowerUsd, debtUsd),
        collateralUsd,
        debtUsd,
        borrowPowerUsd,
        availableBorrowsUsd: Math.max(0, borrowPowerUsd - debtUsd),
        netWorthUsd: collateralUsd - debtUsd
    };
};

export type LoopModel = {
    leverage: number;
    debtUsd: number;
    interestUsd: number;
};

export const loopModel = (
    equityUsd: number,
    collateralFactor: number,
    targetHf: number,
    borrowApr: number,
    years: number
): LoopModel => {
    const safeHf = Math.max(targetHf, collateralFactor + 0.05);
    const leverage = 1 / (1 - collateralFactor / safeHf);
    const debtUsd = equityUsd * (leverage - 1);
    return { leverage, debtUsd, interestUsd: debtUsd * borrowApr * years };
};

export const holdNetWorth = (equityUsd: number, m: number): number => equityUsd * m;

export const loopNetWorth = (equityUsd: number, model: LoopModel, m: number): number =>
    equityUsd * (1 + model.leverage * (m - 1)) - model.interestUsd;

export type PairProjection = {
    healthFactor: number | null;
    suppliedUsd: number;
    debtUsd: number;
};

// Simpler analogue of projectAction for isolated Morpho/Fluid market positions, which have no pooled account
export const projectPairAction = (
    market: PairMarket,
    position: PairPosition | undefined,
    kind: ActionKind,
    amount: number
): PairProjection => {
    let suppliedUsd = position?.suppliedUsd ?? 0;
    let debtUsd = position?.debtUsd ?? 0;
    if (kind === 'supply') suppliedUsd += amount * market.supplyPriceUsd;
    else if (kind === 'withdraw') suppliedUsd = Math.max(0, suppliedUsd - amount * market.supplyPriceUsd);
    else if (kind === 'borrow') debtUsd += amount * market.borrowPriceUsd;
    else debtUsd = Math.max(0, debtUsd - amount * market.borrowPriceUsd);
    return { healthFactor: hf(suppliedUsd * market.maxLtv, debtUsd), suppliedUsd, debtUsd };
};

export const maxPairAmount = (
    market: PairMarket,
    position: PairPosition | undefined,
    kind: ActionKind,
    walletBalance: number
): number => {
    if (kind === 'supply') return walletBalance;
    if (kind === 'withdraw') return position?.supplied ?? 0;
    if (kind === 'repay') return Math.min(position?.debt ?? 0, walletBalance);
    const suppliedUsd = position?.suppliedUsd ?? 0;
    const debtUsd = position?.debtUsd ?? 0;
    const availableUsd = Math.max(0, suppliedUsd * market.maxLtv - debtUsd);
    return market.borrowPriceUsd > 0 ? availableUsd / market.borrowPriceUsd : 0;
};

export const maxAmount = (account: AccountSummary, reserve: ReserveWithUser, kind: ActionKind): number => {
    const price = reserve.priceUsd || 1;
    if (kind === 'supply') return reserve.walletBalance;
    if (kind === 'repay') return Math.min(reserve.debt, reserve.walletBalance);
    if (kind === 'borrow') {
        const byPower = account.availableBorrowsUsd / price;
        const liquidity = reserve.totalSupplied - reserve.totalDebt;
        return Math.max(0, Math.min(byPower, liquidity));
    }
    if (!reserve.isCollateral || reserve.collateralFactor === 0) return reserve.supplied;
    const freeUsd = account.borrowPowerUsd - account.debtUsd;
    const byHealthUsd = freeUsd / reserve.collateralFactor;
    return Math.max(0, Math.min(reserve.supplied, byHealthUsd / price));
};
