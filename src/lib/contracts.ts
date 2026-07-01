import { Contract, MaxUint256, parseUnits, type Signer } from 'ethers';
import { AAVE_V3_POOL_ADDRESS, FLUID_NATIVE_ETH, MORPHO_BLUE_ADDRESS, SPOKE_ADDRESS } from '@shared/constants';
import type { ActionKind, PairMarket, PairPosition, ReserveWithUser } from '@shared/types';
import {
    AAVE_V3_POOL_WRITE_ABI,
    ERC20_WRITE_ABI,
    FLUID_VAULT_WRITE_ABI,
    MORPHO_BLUE_WRITE_ABI,
    SPOKE_WRITE_ABI
} from './abi';

export type ExecStep = 'approve' | 'action' | 'confirm';

const toWei = (amount: string, decimals: number): bigint => {
    const [int, frac = ''] = amount.trim().split('.');
    const clean = `${int || '0'}.${frac.slice(0, decimals) || '0'}`;
    return parseUnits(clean, decimals);
};

const maxBigInt = (a: bigint, b: bigint): bigint => (a > b ? a : b);

const ensureAllowance = async (
    signer: Signer,
    token: string,
    owner: string,
    spender: string,
    needed: bigint,
    onStep?: (step: ExecStep) => void
) => {
    const erc20 = new Contract(token, ERC20_WRITE_ABI, signer);
    const current: bigint = await erc20.allowance(owner, spender);
    if (current >= needed) return;
    onStep?.('approve');
    const tx = await erc20.approve(spender, needed);
    await tx.wait();
};

// --- Aave v4 (Bluechip Spoke) ---

type ExecParams = {
    signer: Signer;
    account: string;
    reserve: ReserveWithUser;
    kind: ActionKind;
    amount: string;
    isMax: boolean;
    onStep?: (step: ExecStep) => void;
};

export const executeAction = async ({
    signer,
    account,
    reserve,
    kind,
    amount,
    isMax,
    onStep
}: ExecParams): Promise<string> => {
    const spoke = new Contract(SPOKE_ADDRESS, SPOKE_WRITE_ABI, signer);
    const token = new Contract(reserve.underlying, ERC20_WRITE_ABI, signer);
    const amountWei = toWei(amount, reserve.decimals);

    if (kind === 'supply') {
        const wei = isMax ? ((await token.balanceOf(account)) as bigint) : amountWei;
        await ensureAllowance(signer, reserve.underlying, account, SPOKE_ADDRESS, wei, onStep);
        onStep?.('action');
        const tx = await spoke.supply(reserve.id, wei, account);
        return (await tx.wait()).hash;
    }

    if (kind === 'repay') {
        const balance = (await token.balanceOf(account)) as bigint;
        const fullRepay = isMax && reserve.walletBalance >= reserve.debt;
        const approveWei = isMax ? balance : amountWei;
        await ensureAllowance(signer, reserve.underlying, account, SPOKE_ADDRESS, approveWei, onStep);
        onStep?.('action');
        const tx = await spoke.repay(reserve.id, fullRepay ? MaxUint256 : amountWei, account);
        return (await tx.wait()).hash;
    }

    if (kind === 'borrow') {
        onStep?.('action');
        const tx = await spoke.borrow(reserve.id, amountWei, account);
        return (await tx.wait()).hash;
    }

    onStep?.('action');
    const tx = await spoke.withdraw(reserve.id, isMax ? MaxUint256 : amountWei, account);
    return (await tx.wait()).hash;
};

export const setCollateral = async (
    signer: Signer,
    account: string,
    reserveId: number,
    useAsCollateral: boolean
): Promise<string> => {
    const spoke = new Contract(SPOKE_ADDRESS, SPOKE_WRITE_ABI, signer);
    const tx = await spoke.setUsingAsCollateral(reserveId, useAsCollateral, account);
    return (await tx.wait()).hash;
};

// --- Aave v3 ---

const VARIABLE_RATE = 2;

export const executeAaveV3Action = async ({
    signer,
    account,
    reserve,
    kind,
    amount,
    isMax,
    onStep
}: ExecParams): Promise<string> => {
    const pool = new Contract(AAVE_V3_POOL_ADDRESS, AAVE_V3_POOL_WRITE_ABI, signer);
    const token = new Contract(reserve.underlying, ERC20_WRITE_ABI, signer);
    const amountWei = toWei(amount, reserve.decimals);

    if (kind === 'supply') {
        const wei = isMax ? ((await token.balanceOf(account)) as bigint) : amountWei;
        await ensureAllowance(signer, reserve.underlying, account, AAVE_V3_POOL_ADDRESS, wei, onStep);
        onStep?.('action');
        const tx = await pool.supply(reserve.underlying, wei, account, 0);
        return (await tx.wait()).hash;
    }

    if (kind === 'repay') {
        const balance = (await token.balanceOf(account)) as bigint;
        const approveWei = isMax ? balance : amountWei;
        await ensureAllowance(signer, reserve.underlying, account, AAVE_V3_POOL_ADDRESS, approveWei, onStep);
        onStep?.('action');
        const tx = await pool.repay(reserve.underlying, isMax ? MaxUint256 : amountWei, VARIABLE_RATE, account);
        return (await tx.wait()).hash;
    }

    if (kind === 'borrow') {
        onStep?.('action');
        const tx = await pool.borrow(reserve.underlying, amountWei, VARIABLE_RATE, 0, account);
        return (await tx.wait()).hash;
    }

    onStep?.('action');
    const tx = await pool.withdraw(reserve.underlying, isMax ? MaxUint256 : amountWei, account);
    return (await tx.wait()).hash;
};

export const setAaveV3Collateral = async (
    signer: Signer,
    asset: string,
    useAsCollateral: boolean
): Promise<string> => {
    const pool = new Contract(AAVE_V3_POOL_ADDRESS, AAVE_V3_POOL_WRITE_ABI, signer);
    const tx = await pool.setUserUseReserveAsCollateral(asset, useAsCollateral);
    return (await tx.wait()).hash;
};

// --- Morpho Blue ---

type MorphoExecParams = {
    signer: Signer;
    account: string;
    market: PairMarket;
    position: PairPosition | undefined;
    kind: ActionKind;
    amount: string;
    isMax: boolean;
    onStep?: (step: ExecStep) => void;
};

const morphoParams = (market: PairMarket) => {
    if (!market.oracleAddress || !market.irmAddress || !market.lltvRaw) {
        throw new Error('Missing Morpho market params');
    }
    return {
        loanToken: market.borrowAddress,
        collateralToken: market.supplyAddress,
        oracle: market.oracleAddress,
        irm: market.irmAddress,
        lltv: BigInt(market.lltvRaw)
    };
};

export const executeMorphoAction = async ({
    signer,
    account,
    market,
    position,
    kind,
    amount,
    isMax,
    onStep
}: MorphoExecParams): Promise<string> => {
    const morpho = new Contract(MORPHO_BLUE_ADDRESS, MORPHO_BLUE_WRITE_ABI, signer);
    const params = morphoParams(market);

    if (kind === 'supply') {
        const token = new Contract(market.supplyAddress, ERC20_WRITE_ABI, signer);
        const wei = isMax ? ((await token.balanceOf(account)) as bigint) : toWei(amount, market.supplyDecimals);
        await ensureAllowance(signer, market.supplyAddress, account, MORPHO_BLUE_ADDRESS, wei, onStep);
        onStep?.('action');
        const tx = await morpho.supplyCollateral(params, wei, account, '0x');
        return (await tx.wait()).hash;
    }

    if (kind === 'withdraw') {
        const wei = isMax && position?.collateralRaw ? BigInt(position.collateralRaw) : toWei(amount, market.supplyDecimals);
        onStep?.('action');
        const tx = await morpho.withdrawCollateral(params, wei, account, account);
        return (await tx.wait()).hash;
    }

    if (kind === 'borrow') {
        onStep?.('action');
        const tx = await morpho.borrow(params, toWei(amount, market.borrowDecimals), 0n, account, account);
        return (await tx.wait()).hash;
    }

    // repay
    const token = new Contract(market.borrowAddress, ERC20_WRITE_ABI, signer);
    if (isMax && position?.borrowSharesRaw) {
        const balance = (await token.balanceOf(account)) as bigint;
        await ensureAllowance(signer, market.borrowAddress, account, MORPHO_BLUE_ADDRESS, balance, onStep);
        onStep?.('action');
        const tx = await morpho.repay(params, 0n, BigInt(position.borrowSharesRaw), account, '0x');
        return (await tx.wait()).hash;
    }
    const wei = toWei(amount, market.borrowDecimals);
    await ensureAllowance(signer, market.borrowAddress, account, MORPHO_BLUE_ADDRESS, wei, onStep);
    onStep?.('action');
    const tx = await morpho.repay(params, wei, 0n, account, '0x');
    return (await tx.wait()).hash;
};

// --- Fluid ---

const FLUID_MIN_INT256 = -(2n ** 255n);
// unlike an ERC-20 max-supply, native ETH sent as collateral is not refunded, so "max" must leave enough behind to pay gas
const NATIVE_GAS_BUFFER = parseUnits('0.01', 18);

type FluidExecParams = {
    signer: Signer;
    account: string;
    market: PairMarket;
    position: PairPosition | undefined;
    kind: ActionKind;
    amount: string;
    isMax: boolean;
    onStep?: (step: ExecStep) => void;
};

const isNativeEth = (address: string) => address.toLowerCase() === FLUID_NATIVE_ETH.toLowerCase();

export const executeFluidAction = async ({
    signer,
    account,
    market,
    position,
    kind,
    amount,
    isMax,
    onStep
}: FluidExecParams): Promise<string> => {
    const vault = new Contract(market.id, FLUID_VAULT_WRITE_ABI, signer);
    const nftId = position ? BigInt(position.id) : 0n;

    let newCol = 0n;
    let newDebt = 0n;
    let value = 0n;

    if (kind === 'supply') {
        const isNative = isNativeEth(market.supplyAddress);
        const wei = isMax
            ? isNative
                ? maxBigInt(0n, (await signer.provider!.getBalance(account)) - NATIVE_GAS_BUFFER)
                : ((await new Contract(market.supplyAddress, ERC20_WRITE_ABI, signer).balanceOf(account)) as bigint)
            : toWei(amount, market.supplyDecimals);
        newCol = wei;
        if (isNative) {
            value = wei;
        } else {
            await ensureAllowance(signer, market.supplyAddress, account, market.id, wei, onStep);
        }
    } else if (kind === 'withdraw') {
        newCol = isMax ? FLUID_MIN_INT256 : -toWei(amount, market.supplyDecimals);
    } else if (kind === 'borrow') {
        newDebt = toWei(amount, market.borrowDecimals);
    } else {
        // repay
        const token = isNativeEth(market.borrowAddress) ? null : new Contract(market.borrowAddress, ERC20_WRITE_ABI, signer);
        if (isMax) {
            newDebt = FLUID_MIN_INT256;
            // exact debt (with accrued interest) is only known on-chain at execution time; the vault refunds any unused msg.value, so sending as much as possible (minus a gas buffer for native ETH) is safe
            if (token) {
                const balance = (await token.balanceOf(account)) as bigint;
                await ensureAllowance(signer, market.borrowAddress, account, market.id, balance, onStep);
            } else {
                value = maxBigInt(0n, (await signer.provider!.getBalance(account)) - NATIVE_GAS_BUFFER);
            }
        } else {
            const wei = toWei(amount, market.borrowDecimals);
            newDebt = -wei;
            if (token) await ensureAllowance(signer, market.borrowAddress, account, market.id, wei, onStep);
            else value = wei;
        }
    }

    onStep?.('action');
    const tx = await vault.operate(nftId, newCol, newDebt, account, { value });
    return (await tx.wait()).hash;
};

export const labelFor: Record<ActionKind, string> = {
    supply: 'Supply',
    withdraw: 'Withdraw',
    borrow: 'Borrow',
    repay: 'Repay'
};
