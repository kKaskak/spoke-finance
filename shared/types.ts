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

export type Platform = 'aave-v3' | 'morpho' | 'fluid';

export type PairMarket = {
    id: string;
    supplySymbol: string;
    supplyAddress: string;
    borrowSymbol: string;
    borrowAddress: string;
    maxLtv: number;
    supplyApr: number;
    borrowApr: number;
    utilization: number;
    totalSuppliedUsd: number;
    totalDebtUsd: number;
};

export type PairPosition = {
    id: string;
    marketId: string;
    supplySymbol: string;
    supplyAddress: string;
    borrowSymbol: string;
    borrowAddress: string;
    supplied: number;
    suppliedUsd: number;
    debt: number;
    debtUsd: number;
    maxLtv: number;
    healthFactor: number | null;
};

export type PlatformSummary = {
    platform: Platform;
    label: string;
    collateralUsd: number;
    debtUsd: number;
    healthFactor: number | null;
    markets: PairMarket[];
    positions: PairPosition[];
};

export type OtherMarketsResponse = {
    aaveV3: Reserve[] | null;
    morpho: PairMarket[] | null;
    fluid: PairMarket[] | null;
};

export type OtherPositionsResponse = {
    aaveV3: PositionResponse | null;
    morpho: PlatformSummary | null;
    fluid: PlatformSummary | null;
};
