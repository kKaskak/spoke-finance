export const SPOKE_READ_ABI = [
    'function getReserveCount() view returns (uint256)',
    'function getReserve(uint256) view returns (address underlying, address hub, uint16 assetId, uint8 decimals, uint24 collateralRisk, uint8 flags, uint32 dynamicConfigKey)',
    'function getReserveConfig(uint256) view returns (uint24 collateralRisk, bool paused, bool frozen, bool borrowable, bool receiveSharesEnabled)',
    'function getDynamicReserveConfig(uint256 reserveId, uint32 dynamicConfigKey) view returns (uint16 collateralFactor, uint32 maxLiquidationBonus, uint16 liquidationFee)',
    'function getReserveSuppliedAssets(uint256) view returns (uint256)',
    'function getReserveTotalDebt(uint256) view returns (uint256)',
    'function getUserAccountData(address) view returns (uint256 riskPremium, uint256 avgCollateralFactor, uint256 healthFactor, uint256 totalCollateralValue, uint256 totalDebtValueRay, uint256 activeCollateralCount, uint256 borrowCount)',
    'function getUserSuppliedAssets(uint256, address) view returns (uint256)',
    'function getUserTotalDebt(uint256, address) view returns (uint256)',
    'function getUserReserveStatus(uint256, address) view returns (bool isCollateral, bool isBorrowed)'
];

export const ORACLE_ABI = [
    'function getReservePrice(uint256) view returns (uint256)',
    'function getReservesPrices(uint256[]) view returns (uint256[])'
];

export const HUB_ABI = [
    'function getAssetDrawnRate(uint256) view returns (uint256)'
];

export const ERC20_ABI = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)'
];

export const AAVE_V3_POOL_ABI = [
    'function getReservesList() view returns (address[])',
    'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

export const AAVE_V3_DATA_PROVIDER_ABI = [
    'function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)',
    'function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
    'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)',
    'function getPaused(address asset) view returns (bool)'
];

export const AAVE_V3_ORACLE_ABI = [
    'function getAssetPrice(address asset) view returns (uint256)'
];

const tokensT = { type: 'tuple', components: [
    { name: 'token0', type: 'address' },
    { name: 'token1', type: 'address' }
] };

const constantViewsT = { type: 'tuple', components: [
    { name: 'liquidity', type: 'address' },
    { name: 'factory', type: 'address' },
    { name: 'operateImplementation', type: 'address' },
    { name: 'adminImplementation', type: 'address' },
    { name: 'secondaryImplementation', type: 'address' },
    { name: 'deployer', type: 'address' },
    { name: 'supply', type: 'address' },
    { name: 'borrow', type: 'address' },
    { name: 'supplyToken', ...tokensT },
    { name: 'borrowToken', ...tokensT },
    { name: 'vaultId', type: 'uint256' },
    { name: 'vaultType', type: 'uint256' },
    { name: 'supplyExchangePriceSlot', type: 'bytes32' },
    { name: 'borrowExchangePriceSlot', type: 'bytes32' },
    { name: 'userSupplySlot', type: 'bytes32' },
    { name: 'userBorrowSlot', type: 'bytes32' }
] };

const configsT = { type: 'tuple', components: [
    { name: 'supplyRateMagnifier', type: 'uint16' },
    { name: 'borrowRateMagnifier', type: 'uint16' },
    { name: 'collateralFactor', type: 'uint16' },
    { name: 'liquidationThreshold', type: 'uint16' },
    { name: 'liquidationMaxLimit', type: 'uint16' },
    { name: 'withdrawalGap', type: 'uint16' },
    { name: 'liquidationPenalty', type: 'uint16' },
    { name: 'borrowFee', type: 'uint16' },
    { name: 'oracle', type: 'address' },
    { name: 'oraclePriceOperate', type: 'uint256' },
    { name: 'oraclePriceLiquidate', type: 'uint256' },
    { name: 'rebalancer', type: 'address' },
    { name: 'lastUpdateTimestamp', type: 'uint256' }
] };

const exchangePricesAndRatesT = { type: 'tuple', components: [
    { name: 'lastStoredLiquiditySupplyExchangePrice', type: 'uint256' },
    { name: 'lastStoredLiquidityBorrowExchangePrice', type: 'uint256' },
    { name: 'lastStoredVaultSupplyExchangePrice', type: 'uint256' },
    { name: 'lastStoredVaultBorrowExchangePrice', type: 'uint256' },
    { name: 'liquiditySupplyExchangePrice', type: 'uint256' },
    { name: 'liquidityBorrowExchangePrice', type: 'uint256' },
    { name: 'vaultSupplyExchangePrice', type: 'uint256' },
    { name: 'vaultBorrowExchangePrice', type: 'uint256' },
    { name: 'supplyRateLiquidity', type: 'uint256' },
    { name: 'borrowRateLiquidity', type: 'uint256' },
    { name: 'supplyRateVault', type: 'int256' },
    { name: 'borrowRateVault', type: 'int256' },
    { name: 'rewardsOrFeeRateSupply', type: 'int256' },
    { name: 'rewardsOrFeeRateBorrow', type: 'int256' }
] };

const totalSupplyAndBorrowT = { type: 'tuple', components: [
    { name: 'totalSupplyVault', type: 'uint256' },
    { name: 'totalBorrowVault', type: 'uint256' },
    { name: 'totalSupplyLiquidityOrDex', type: 'uint256' },
    { name: 'totalBorrowLiquidityOrDex', type: 'uint256' },
    { name: 'absorbedSupply', type: 'uint256' },
    { name: 'absorbedBorrow', type: 'uint256' }
] };

const limitsAndAvailabilityT = { type: 'tuple', components: [
    { name: 'withdrawLimit', type: 'uint256' },
    { name: 'withdrawableUntilLimit', type: 'uint256' },
    { name: 'withdrawable', type: 'uint256' },
    { name: 'borrowLimit', type: 'uint256' },
    { name: 'borrowableUntilLimit', type: 'uint256' },
    { name: 'borrowable', type: 'uint256' },
    { name: 'borrowLimitUtilization', type: 'uint256' },
    { name: 'minimumBorrowing', type: 'uint256' }
] };

const currentBranchStateT = { type: 'tuple', components: [
    { name: 'status', type: 'uint256' },
    { name: 'minimaTick', type: 'int256' },
    { name: 'debtFactor', type: 'uint256' },
    { name: 'partials', type: 'uint256' },
    { name: 'debtLiquidity', type: 'uint256' },
    { name: 'baseBranchId', type: 'uint256' },
    { name: 'baseBranchMinima', type: 'int256' }
] };

const vaultStateT = { type: 'tuple', components: [
    { name: 'totalPositions', type: 'uint256' },
    { name: 'topTick', type: 'int256' },
    { name: 'currentBranch', type: 'uint256' },
    { name: 'totalBranch', type: 'uint256' },
    { name: 'totalBorrow', type: 'uint256' },
    { name: 'totalSupply', type: 'uint256' },
    { name: 'currentBranchState', ...currentBranchStateT }
] };

const userSupplyDataT = { type: 'tuple', components: [
    { name: 'modeWithInterest', type: 'bool' },
    { name: 'supply', type: 'uint256' },
    { name: 'withdrawalLimit', type: 'uint256' },
    { name: 'lastUpdateTimestamp', type: 'uint256' },
    { name: 'expandPercent', type: 'uint256' },
    { name: 'expandDuration', type: 'uint256' },
    { name: 'baseWithdrawalLimit', type: 'uint256' },
    { name: 'withdrawableUntilLimit', type: 'uint256' },
    { name: 'withdrawable', type: 'uint256' },
    { name: 'decayEndTimestamp', type: 'uint256' },
    { name: 'decayAmount', type: 'uint256' }
] };

const userBorrowDataT = { type: 'tuple', components: [
    { name: 'modeWithInterest', type: 'bool' },
    { name: 'borrow', type: 'uint256' },
    { name: 'borrowLimit', type: 'uint256' },
    { name: 'lastUpdateTimestamp', type: 'uint256' },
    { name: 'expandPercent', type: 'uint256' },
    { name: 'expandDuration', type: 'uint256' },
    { name: 'baseBorrowLimit', type: 'uint256' },
    { name: 'maxBorrowLimit', type: 'uint256' },
    { name: 'borrowableUntilLimit', type: 'uint256' },
    { name: 'borrowable', type: 'uint256' },
    { name: 'borrowLimitUtilization', type: 'uint256' }
] };

const vaultEntireDataT = { type: 'tuple', components: [
    { name: 'vault', type: 'address' },
    { name: 'isSmartCol', type: 'bool' },
    { name: 'isSmartDebt', type: 'bool' },
    { name: 'constantVariables', ...constantViewsT },
    { name: 'configs', ...configsT },
    { name: 'exchangePricesAndRates', ...exchangePricesAndRatesT },
    { name: 'totalSupplyAndBorrow', ...totalSupplyAndBorrowT },
    { name: 'limitsAndAvailability', ...limitsAndAvailabilityT },
    { name: 'vaultState', ...vaultStateT },
    { name: 'liquidityUserSupplyData', ...userSupplyDataT },
    { name: 'liquidityUserBorrowData', ...userBorrowDataT }
] };

const userPositionT = { type: 'tuple', components: [
    { name: 'nftId', type: 'uint256' },
    { name: 'owner', type: 'address' },
    { name: 'isLiquidated', type: 'bool' },
    { name: 'isSupplyPosition', type: 'bool' },
    { name: 'tick', type: 'int256' },
    { name: 'tickId', type: 'uint256' },
    { name: 'beforeSupply', type: 'uint256' },
    { name: 'beforeBorrow', type: 'uint256' },
    { name: 'beforeDustBorrow', type: 'uint256' },
    { name: 'supply', type: 'uint256' },
    { name: 'borrow', type: 'uint256' },
    { name: 'dustBorrow', type: 'uint256' }
] };

export const FLUID_VAULT_RESOLVER_ABI = [
    {
        type: 'function',
        name: 'getVaultsEntireData',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: 'vaultsData_', type: 'tuple[]', components: vaultEntireDataT.components }]
    },
    {
        type: 'function',
        name: 'positionsByUser',
        stateMutability: 'view',
        inputs: [{ name: 'user_', type: 'address' }],
        outputs: [
            { name: 'userPositions_', type: 'tuple[]', components: userPositionT.components },
            { name: 'vaultsData_', type: 'tuple[]', components: vaultEntireDataT.components }
        ]
    }
];
