import { MORPHO_BLUE_ADDRESS, SPOKE_ADDRESS, WETH_ADDRESS } from '../shared/constants';
import type { HistoryResponse, TradeLeg } from '../shared/types';
import { loadRawReserves } from './data';
import { type Flow, runLedger, toTracked } from './ledger';
import { withRetry } from './util';

type Transfer = { hash: string; timeStamp: string; from: string; to: string; value: string; isError?: string; contractAddress?: string; tokenSymbol?: string; tokenDecimal?: string };

const ETH = 'coingecko:ethereum';
const DUST_USD = 1;
const historyCache = new Map<string, { at: number; data: HistoryResponse }>();
const priceCache = new Map<string, number | null>();
let currentCache: { at: number; data: Map<string, number> } | null = null;

// ponytail: single 10k page per action; wallets above that need startblock paging
const etherscan = async (action: string, address: string): Promise<Transfer[]> => {
    const key = process.env.ETH_SCAN_API_KEY;
    if (!key) throw new Error('ETH_SCAN_API_KEY missing in .env');
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${key}`;
    return withRetry(async () => {
        const body = await (await fetch(url)).json() as { status: string; message: string; result: Transfer[] | string };
        if (Array.isArray(body.result)) return body.result;
        if (/no transactions found/i.test(body.message)) return [];
        throw new Error(`etherscan ${action}: ${body.result}`);
    });
};

const llama = async <T>(path: string): Promise<T> =>
    withRetry(async () => {
        const res = await fetch(`https://coins.llama.fi/${path}`);
        if (!res.ok) throw new Error(`llama ${res.status}`);
        return res.json() as Promise<T>;
    });

type LlamaPrices = { coins: Record<string, { price: number; prices?: { timestamp: number; price: number }[] }> };

const historicalPrices = async (pairs: { coin: string; ts: number }[]) => {
    const need = [...new Map(pairs.filter((p) => !priceCache.has(`${p.coin}@${p.ts}`)).map((p) => [`${p.coin}@${p.ts}`, p])).values()];
    const chunks: { coin: string; ts: number }[][] = [];
    for (let i = 0; i < need.length; i += 60) chunks.push(need.slice(i, i + 60));
    await Promise.all(chunks.map(async (chunk) => {
        const req: Record<string, number[]> = {};
        for (const p of chunk) (req[p.coin] ??= []).push(p.ts);
        const res = await llama<LlamaPrices>(`batchHistorical?coins=${encodeURIComponent(JSON.stringify(req))}&searchWidth=4h`);
        for (const p of chunk) {
            const prices = res.coins[p.coin]?.prices ?? [];
            const nearest = prices.reduce<{ timestamp: number; price: number } | null>((best, x) => (!best || Math.abs(x.timestamp - p.ts) < Math.abs(best.timestamp - p.ts) ? x : best), null);
            priceCache.set(`${p.coin}@${p.ts}`, nearest && Math.abs(nearest.timestamp - p.ts) < 86_400 ? nearest.price : null);
        }
    }));
};

const currentPrices = async (coins: string[]): Promise<Map<string, number>> => {
    if (currentCache && Date.now() - currentCache.at < 60_000 && coins.every((c) => currentCache!.data.has(c))) return currentCache.data;
    const res = await llama<LlamaPrices>(`prices/current/${coins.join(',')}`);
    const data = new Map(Object.entries(res.coins).map(([c, v]) => [c, v.price]));
    currentCache = { at: Date.now(), data };
    return data;
};

type RawLeg = TradeLeg & { coin: string; native: boolean };

const symbolOf = (t: Transfer): { symbol: string; native: boolean } | null => {
    const raw = t.tokenSymbol || t.contractAddress!.slice(0, 6);
    if (/^(variable|stable)Debt/.test(raw)) return null;
    if (t.contractAddress!.toLowerCase() === WETH_ADDRESS.toLowerCase()) return { symbol: 'ETH', native: true };
    const aToken = /^aEth(.+)$/.exec(raw);
    return aToken ? { symbol: aToken[1], native: false } : { symbol: raw, native: true };
};

const buildFlows = async (address: string): Promise<Flow[]> => {
    const me = address.toLowerCase();
    const [txs, internal, tokens, reserves] = await Promise.all([
        etherscan('txlist', address),
        etherscan('txlistinternal', address),
        etherscan('tokentx', address),
        loadRawReserves()
    ]);
    const protocol = new Set([SPOKE_ADDRESS, MORPHO_BLUE_ADDRESS, ...reserves.map((r) => r.hub)].map((a) => a.toLowerCase()));
    const flows = new Map<string, { ts: number; legs: Map<string, RawLeg> }>();
    const borrowed = new Set<string>();
    const add = (t: Transfer, leg: RawLeg) => {
        const other = t.from.toLowerCase() === me ? t.to : t.from;
        if (protocol.has(other.toLowerCase()) || leg.amount === 0) return;
        const flow = flows.get(t.hash) ?? { ts: Number(t.timeStamp), legs: new Map() };
        flows.set(t.hash, flow);
        const cur = flow.legs.get(leg.symbol);
        if (!cur) flow.legs.set(leg.symbol, leg);
        else {
            cur.amount += leg.amount;
            if (!cur.native && leg.native) Object.assign(cur, { address: leg.address, coin: leg.coin, native: true });
        }
    };
    for (const t of [...txs, ...internal]) {
        if (t.isError !== '0' || t.value === '0') continue;
        const amount = Number(t.value) / 1e18;
        const sign = t.to.toLowerCase() === me ? 1 : t.from.toLowerCase() === me ? -1 : 0;
        if (sign) add(t, { symbol: 'ETH', address: WETH_ADDRESS, coin: ETH, native: true, amount: sign * amount, usd: null });
    }
    for (const t of tokens) {
        const debt = /^(?:variable|stable)Debt(?:Eth)?(.+)$/.exec(t.tokenSymbol ?? '');
        if (debt) borrowed.add(`${t.hash}:${debt[1]}`);
        const sym = symbolOf(t);
        if (!sym) continue;
        const amount = Number(t.value) / 10 ** Number(t.tokenDecimal || 18);
        const sign = t.to.toLowerCase() === me ? 1 : -1;
        add(t, { ...sym, address: t.contractAddress!, coin: `ethereum:${t.contractAddress}`, amount: sign * amount, usd: null });
    }
    for (const [hash, f] of flows) for (const symbol of f.legs.keys()) if (borrowed.has(`${hash}:${symbol}`)) f.legs.delete(symbol);
    const legs = [...flows.values()].flatMap((f) => [...f.legs.values()].map((l) => ({ ...l, ts: f.ts })));
    await historicalPrices(legs.map((l) => ({ coin: l.coin, ts: l.ts })));
    return [...flows.entries()].map(([hash, f]) => ({
        hash,
        ts: f.ts,
        legs: [...f.legs.values()]
            .map(({ coin, native: _n, ...leg }): TradeLeg => {
                const price = priceCache.get(`${coin}@${f.ts}`) ?? null;
                return { ...leg, usd: price === null ? null : leg.amount * price };
            })
            .filter((l) => l.usd === null || Math.abs(l.usd) >= DUST_USD)
    })).filter((f) => f.legs.some((l) => l.usd !== null));
};

const coinOf = (address: string) => (address.toLowerCase() === WETH_ADDRESS.toLowerCase() ? ETH : `ethereum:${address.toLowerCase()}`);

export const getHistory = async (address: string): Promise<HistoryResponse> => {
    const cached = historyCache.get(address);
    if (cached && Date.now() - cached.at < 300_000) return cached.data;
    const { assets, events } = runLedger(await buildFlows(address));
    const accs = [...assets.values()];
    const prices = accs.length ? await currentPrices([...new Set(accs.map((a) => coinOf(a.address)))]) : new Map<string, number>();
    const tracked = accs
        .map((a) => toTracked(a, prices.get(coinOf(a.address)) ?? null))
        .filter((a) => a.qty > 0 || a.soldQty > 0)
        .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0) || Math.abs(b.realizedUsd) - Math.abs(a.realizedUsd));
    const sum = (k: 'boughtUsd' | 'soldUsd' | 'costUsd' | 'valueUsd' | 'realizedUsd' | 'unrealizedUsd') => tracked.reduce((s, a) => s + (a[k] ?? 0), 0);
    const data: HistoryResponse = {
        address,
        assets: tracked,
        events: events.sort((a, b) => b.ts - a.ts),
        summary: { boughtUsd: sum('boughtUsd'), soldUsd: sum('soldUsd'), costUsd: sum('costUsd'), valueUsd: sum('valueUsd'), realizedUsd: sum('realizedUsd'), unrealizedUsd: sum('unrealizedUsd') }
    };
    historyCache.set(address, { at: Date.now(), data });
    return data;
};
