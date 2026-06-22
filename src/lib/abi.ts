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
