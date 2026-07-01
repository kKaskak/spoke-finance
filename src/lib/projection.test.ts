import assert from 'node:assert';
import type { AccountSummary, ReserveWithUser } from '@shared/types';
import { holdNetWorth, loopModel, loopNetWorth, maxAmount, projectAction } from './projection';

const account = {
    address: '0x0',
    healthFactor: 1.8749,
    collateralUsd: 51656.89,
    debtUsd: 23489.13,
    borrowPowerUsd: 44039.22,
    availableBorrowsUsd: 20550.09,
    avgCollateralFactor: 0.8525,
    netWorthUsd: 28167.76,
    netApr: 0,
    riskPremiumBps: 0
} as AccountSummary;

const usdc = {
    id: 4,
    symbol: 'USDC',
    decimals: 6,
    priceUsd: 1,
    collateralFactor: 0,
    canBeCollateral: false,
    borrowable: true,
    isCollateral: false,
    isBorrowed: false,
    supplied: 0,
    debt: 0,
    walletBalance: 0,
    totalSupplied: 1761634,
    totalDebt: 1551000
} as ReserveWithUser;

const weth = {
    id: 0,
    symbol: 'WETH',
    decimals: 18,
    priceUsd: 1729.57,
    collateralFactor: 0.86,
    canBeCollateral: true,
    borrowable: false,
    isCollateral: true,
    supplied: 15,
    debt: 0,
    walletBalance: 2
} as ReserveWithUser;

const near = (a: number, b: number, eps = 0.02) => assert(Math.abs(a - b) < eps, `${a} !~ ${b}`);

const borrow = projectAction(account, usdc, 'borrow', 7176.7);
near(borrow.healthFactor ?? 0, 1.436, 0.01);
near(borrow.availableBorrowsUsd, 13373.4, 1);

const repayAll = projectAction(account, usdc, 'repay', account.debtUsd);
assert(repayAll.healthFactor === null, 'full repay should clear debt to infinite HF');

const supply = projectAction(account, weth, 'supply', 2);
near(supply.borrowPowerUsd, 44039.22 + 2 * 1729.57 * 0.86, 1);

const maxBorrow = maxAmount(account, usdc, 'borrow');
near(maxBorrow, 20550.09, 1);

const noDebt = projectAction({ ...account, debtUsd: 0, borrowPowerUsd: 44039.22 } as AccountSummary, weth, 'supply', 1);
assert(noDebt.healthFactor === null, 'no debt means infinite HF');

near(loopModel(1000, 0.8, 2.0, 0, 0).leverage, 1.667, 0.01);
near(loopModel(1000, 0.8, 1.9, 0, 0).leverage, 1.727, 0.01);

const loop = loopModel(10000, 0.8, 2.0, 0.035, 2);
near(loop.debtUsd, 6667, 1);
near(loop.interestUsd, 6667 * 0.035 * 2, 1);
near(holdNetWorth(10000, 1), 10000, 0.01);
near(loopNetWorth(10000, loop, 1), 10000 - loop.interestUsd, 0.01);
assert(loopNetWorth(10000, loop, 2) > holdNetWorth(10000, 2), 'loop should beat hold when price doubles');

console.log('projection checks passed');
