import assert from 'node:assert';
import { erc20Iface } from './chain';
import { multicall } from './multicall';
import { decodeSymbol } from './util';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';
const EOA = '0x1111111111111111111111111111111111111111';

const run = async () => {
    const [usdcSym, usdcDec, mkrSym] = await multicall([
        { target: USDC, iface: erc20Iface, method: 'symbol', decode: (d) => decodeSymbol(d, 'USDC') },
        { target: USDC, iface: erc20Iface, method: 'decimals' },
        { target: MKR, iface: erc20Iface, method: 'symbol', decode: (d) => decodeSymbol(d, 'MKR') }
    ]);
    assert.equal(usdcSym, 'USDC');
    assert.equal(Number(usdcDec), 6);
    assert.equal(mkrSym, 'MKR');
    await assert.rejects(multicall([{ target: EOA, iface: erc20Iface, method: 'decimals' }]), /multicall: decimals/);
    console.warn('multicall.test ok:', { usdcSym, usdcDec: Number(usdcDec), mkrSym, failedCallThrows: true });
};

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
