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
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)'
];
