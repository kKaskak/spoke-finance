export const SPOKE_WRITE_ABI = [
    'function supply(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
    'function withdraw(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
    'function borrow(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
    'function repay(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
    'function setUsingAsCollateral(uint256 reserveId, bool usingAsCollateral, address onBehalfOf)'
];

export const ERC20_WRITE_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
];

export const AAVE_V3_POOL_WRITE_ABI = [
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
    'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)',
    'function setUserUseReserveAsCollateral(address asset, bool useAsCollateral)'
];

export const MORPHO_BLUE_WRITE_ABI = [
    'function supplyCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)',
    'function withdrawCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, address receiver)',
    'function borrow((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)',
    'function repay((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)'
];

export const FLUID_VAULT_WRITE_ABI = [
    'function operate(uint256 nftId_, int256 newCol_, int256 newDebt_, address to_) payable returns (uint256, int256, int256)',
    'event LogOperate(address user_, uint256 nftId_, int256 colAmt_, int256 debtAmt_, address to_)'
];
