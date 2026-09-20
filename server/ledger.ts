import type { Chain, TradeEvent, TradeLeg, TrackedAsset } from '../shared/types';

export type Flow = { hash: string; chain: Chain; ts: number; legs: TradeLeg[]; bridge?: boolean };

export type Acc = {
    symbol: string;
    address: string;
    chain: Chain;
    qty: number;
    costUsd: number;
    boughtQty: number;
    boughtUsd: number;
    soldQty: number;
    soldUsd: number;
    realizedUsd: number;
};

export const STABLES = new Set([
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0xdac17f958d2ee523a2206206994597c13d831ec7',
    '0x6b175474e89094c44da98b954eedeac495271d0f',
    '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f',
    '0xdc035d45d973e3ec169d2276ddab16f1e407384f',
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
    '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
    '0x6bb7a212910682dcfdbd5bcbb3e28fb4e8da10ee'
]);

const sideUsd = (side: TradeLeg[]): number | null =>
    side.length > 0 && side.every((l) => l.usd !== null) ? side.reduce((s, l) => s + Math.abs(l.usd!), 0) : null;

const hasStable = (side: TradeLeg[]) => side.some((l) => STABLES.has(l.address.toLowerCase()));

const acc = (map: Map<string, Acc>, leg: TradeLeg, chain: Chain): Acc => {
    let a = map.get(leg.symbol);
    if (!a) {
        a = { symbol: leg.symbol, address: leg.address, chain, qty: 0, costUsd: 0, boughtQty: 0, boughtUsd: 0, soldQty: 0, soldUsd: 0, realizedUsd: 0 };
        map.set(leg.symbol, a);
    } else if (a.chain !== 'ethereum' && chain === 'ethereum') {
        Object.assign(a, { address: leg.address, chain });
    }
    return a;
};

const buy = (a: Acc, qty: number, usd: number) => {
    a.qty += qty;
    a.costUsd += usd;
    a.boughtQty += qty;
    a.boughtUsd += usd;
};

// ponytail: average cost; units sold beyond what was tracked (borrows, interest) take market basis so they add no P&L
const sell = (a: Acc, qty: number, usd: number) => {
    const held = Math.min(qty, a.qty);
    const avg = a.qty > 0 ? a.costUsd / a.qty : 0;
    const basis = held * avg + (qty - held) * (usd / qty);
    a.realizedUsd += usd - basis;
    a.costUsd -= held * avg;
    a.qty -= held;
    a.soldQty += qty;
    a.soldUsd += usd;
};

const split = (side: TradeLeg[], total: number): number[] => {
    const own = sideUsd(side);
    return side.map((l) => (own ? (total * Math.abs(l.usd!)) / own : total / side.length));
};

export const runLedger = (flows: Flow[]): { assets: Map<string, Acc>; events: TradeEvent[] } => {
    const assets = new Map<string, Acc>();
    const events: TradeEvent[] = [];
    for (const flow of [...flows].sort((a, b) => a.ts - b.ts)) {
        const ins = flow.legs.filter((l) => l.amount > 0);
        const outs = flow.legs.filter((l) => l.amount < 0);
        if (ins.length === 0 && outs.length === 0) continue;
        const kind = flow.bridge ? 'bridge' : ins.length && outs.length ? 'swap' : ins.length ? 'receive' : 'send';
        const inUsd = sideUsd(ins);
        const outUsd = sideUsd(outs);
        const value = kind === 'swap' ? (hasStable(ins) && inUsd !== null ? inUsd : outUsd ?? inUsd) : kind === 'receive' ? inUsd : kind === 'send' ? outUsd : inUsd ?? outUsd;
        const inValues = value === null ? [] : split(ins, value);
        const outValues = value === null ? [] : split(outs, value);
        if (value !== null && kind !== 'bridge') {
            outs.forEach((l, i) => sell(acc(assets, l, flow.chain), -l.amount, outValues[i]));
            ins.forEach((l, i) => buy(acc(assets, l, flow.chain), l.amount, inValues[i]));
        }
        events.push({
            hash: flow.hash,
            chain: flow.chain,
            ts: flow.ts,
            kind,
            legs: [
                ...outs.map((l, i) => ({ ...l, usd: value === null ? null : -outValues[i] })),
                ...ins.map((l, i) => ({ ...l, usd: value === null ? null : inValues[i] }))
            ],
            valueUsd: value
        });
    }
    return { assets, events };
};

// a single-asset send on one chain matched by a receive of the same asset on the other within 3h and 3% is a bridge, not a trade
export const markBridges = (flows: Flow[]): Flow[] => {
    const single = (f: Flow) => (f.legs.length === 1 ? f.legs[0] : null);
    const receives = flows.filter((f) => (single(f)?.amount ?? 0) > 0).sort((a, b) => a.ts - b.ts);
    const used = new Set<Flow>();
    for (const send of flows) {
        const out = single(send);
        if (!out || out.amount >= 0) continue;
        const match = receives.find((r) => {
            const leg = r.legs[0];
            return !used.has(r) && r.chain !== send.chain && leg.symbol === out.symbol && r.ts >= send.ts - 300 && r.ts <= send.ts + 10_800 && Math.abs(leg.amount + out.amount) <= 0.03 * -out.amount;
        });
        if (!match) continue;
        used.add(match);
        send.bridge = true;
        match.bridge = true;
    }
    return flows;
};

export const toTracked = (a: Acc, priceUsd: number | null): TrackedAsset => {
    const qty = a.qty > 1e-12 ? a.qty : 0;
    const valueUsd = priceUsd === null ? null : qty * priceUsd;
    return {
        symbol: a.symbol,
        address: a.address,
        chain: a.chain,
        qty,
        costUsd: a.costUsd,
        avgCost: qty > 0 ? a.costUsd / qty : 0,
        avgBuy: a.boughtQty > 0 ? a.boughtUsd / a.boughtQty : 0,
        avgSell: a.soldQty > 0 ? a.soldUsd / a.soldQty : 0,
        boughtQty: a.boughtQty,
        boughtUsd: a.boughtUsd,
        soldQty: a.soldQty,
        soldUsd: a.soldUsd,
        realizedUsd: a.realizedUsd,
        priceUsd,
        valueUsd,
        unrealizedUsd: valueUsd === null ? null : valueUsd - a.costUsd
    };
};
