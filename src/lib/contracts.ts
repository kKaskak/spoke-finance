import { Contract, MaxUint256, parseUnits, type Signer } from 'ethers';
import { SPOKE_ADDRESS } from '@shared/constants';
import type { ActionKind, ReserveWithUser } from '@shared/types';
import { ERC20_WRITE_ABI, SPOKE_WRITE_ABI } from './abi';

export type ExecStep = 'approve' | 'action' | 'confirm';

type ExecParams = {
    signer: Signer;
    account: string;
    reserve: ReserveWithUser;
    kind: ActionKind;
    amount: string;
    isMax: boolean;
    onStep?: (step: ExecStep) => void;
};

const toWei = (amount: string, decimals: number): bigint => {
    const [int, frac = ''] = amount.trim().split('.');
    const clean = `${int || '0'}.${frac.slice(0, decimals) || '0'}`;
    return parseUnits(clean, decimals);
};

const ensureAllowance = async (
    signer: Signer,
    token: string,
    owner: string,
    needed: bigint,
    onStep?: (step: ExecStep) => void
) => {
    const erc20 = new Contract(token, ERC20_WRITE_ABI, signer);
    const current: bigint = await erc20.allowance(owner, SPOKE_ADDRESS);
    if (current >= needed) return;
    onStep?.('approve');
    const tx = await erc20.approve(SPOKE_ADDRESS, needed);
    await tx.wait();
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
        await ensureAllowance(signer, reserve.underlying, account, wei, onStep);
        onStep?.('action');
        const tx = await spoke.supply(reserve.id, wei, account);
        return (await tx.wait()).hash;
    }

    if (kind === 'repay') {
        const balance = (await token.balanceOf(account)) as bigint;
        const fullRepay = isMax && reserve.walletBalance >= reserve.debt;
        const approveWei = isMax ? balance : amountWei;
        await ensureAllowance(signer, reserve.underlying, account, approveWei, onStep);
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

export const labelFor: Record<ActionKind, string> = {
    supply: 'Supply',
    withdraw: 'Withdraw',
    borrow: 'Borrow',
    repay: 'Repay'
};
