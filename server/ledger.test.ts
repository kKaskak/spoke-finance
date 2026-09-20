import assert from 'node:assert/strict';
import { markBridges, runLedger, toTracked } from './ledger';

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const leg = (symbol: string, address: string, amount: number, usd: number | null) => ({ symbol, address, amount, usd });

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

const { assets, events } = runLedger(markBridges([
    { hash: 'a', chain: 'ethereum', ts: 1, legs: [leg('ETH', WETH, 1, 1990), leg('USDC', USDC, -2000, 2000)] },
    { hash: 'b', chain: 'base', ts: 2, legs: [leg('ETH', WETH, 1, 3000)] },
    { hash: 'c', chain: 'ethereum', ts: 3, legs: [leg('ETH', WETH, -1, 3980), leg('USDC', USDC, 4000, 4000)] },
    { hash: 'd', chain: 'base', ts: 4, legs: [leg('GHO', '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f', -300, 300), leg('cbBTC', '0xcb', 0.01, null)] },
    { hash: 'e', chain: 'base', ts: 5, legs: [leg('RAIL', '0xra', 10, null)] },
    { hash: 'f', chain: 'base', ts: 100, legs: [leg('ETH', WETH, -0.5, 1500)] },
    { hash: 'g', chain: 'ethereum', ts: 160, legs: [leg('ETH', WETH, 0.499, 1497)] },
    { hash: 'h', chain: 'ethereum', ts: 200, legs: [leg('ETH', WETH, -0.5, 1500)] }
]));

const eth = toTracked(assets.get('ETH')!, 5000);
near(eth.qty, 0.5);
assert.equal(events[5].kind, 'bridge');
assert.equal(events[6].kind, 'bridge');
assert.equal(events[7].kind, 'send');
near(eth.boughtUsd, 5000);
near(eth.soldUsd, 5500);
assert.equal(eth.chain, 'ethereum');
assert.equal(events[1].chain, 'base');
near(eth.avgCost, 2500);
near(eth.realizedUsd, 1500 + 1500 - 1250);
near(eth.avgBuy, 2500);
near(eth.avgSell, 5500 / 1.5);
near(eth.unrealizedUsd!, 1250);
assert.equal(events[0].kind, 'swap');
assert.equal(events[0].valueUsd, 2000);
assert.equal(events[1].kind, 'receive');
assert.equal(events[2].valueUsd, 4000);

const gho = toTracked(assets.get('GHO')!, 1);
near(gho.realizedUsd, 0);
near(gho.qty, 0);
const btc = toTracked(assets.get('cbBTC')!, null);
near(btc.costUsd, 300);
assert.equal(btc.unrealizedUsd, null);
assert.equal(events[4].valueUsd, null);
assert.equal(assets.has('RAIL'), false);

console.log('ledger ok');
