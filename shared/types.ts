export type Reserve = {
    id: number;
    symbol: string;
    underlying: string;
    decimals: number;
    priceUsd: number;
    collateralFactor: number;
    liquidationBonusBps: number;
    liquidationFeeBps: number;
    canBeCollateral: boolean;
    borrowable: boolean;
    frozen: boolean;
    paused: boolean;
    borrowApr: number;
    supplyApr: number;
    utilization: number;
    totalSupplied: number;
    totalSuppliedUsd: number;
    totalDebt: number;
    totalDebtUsd: number;
};

export type UserReserve = {
    supplied: number;
    suppliedUsd: number;
    debt: number;
    debtUsd: number;
    isCollateral: boolean;
    isBorrowed: boolean;
    walletBalance: number;
    walletBalanceUsd: number;
    allowance: number;
};

export type ReserveWithUser = Reserve & UserReserve;

export type AccountSummary = {
    address: string;
    healthFactor: number | null;
    collateralUsd: number;
    debtUsd: number;
    borrowPowerUsd: number;
    availableBorrowsUsd: number;
    avgCollateralFactor: number;
    netWorthUsd: number;
    netApr: number;
    riskPremiumBps: number;
};

export type PositionResponse = {
    account: AccountSummary;
    reserves: ReserveWithUser[];
};

export type ActionKind = 'supply' | 'withdraw' | 'borrow' | 'repay';
