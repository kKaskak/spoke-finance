import { MORPHO_BLUE_ADDRESS, SPOKE_ADDRESS, WETH_ADDRESS } from '../shared/constants';
import type { Chain, HistoryResponse, TradeLeg } from '../shared/types';
import { loadRawReserves } from './data';
import { type Flow, markBridges, runLedger, STABLES, toTracked } from './ledger';
import { withRetry } from './util';

type Xfer = { chain: Chain; hash: string; ts: number; from: string; to: string; amount: number; symbol: string; contract: string | null };
type ScanRow = { hash: string; timeStamp: string; from: string; to: string; value: string; isError?: string; contractAddress?: string; tokenSymbol?: string; tokenDecimal?: string };
type AlchemyXfer = { uniqueId: string; hash: string; from: string; to: string | null; value: number | null; asset: string | null; category: string; rawContract: { address: string | null }; metadata: { blockTimestamp: string } };
type LlamaPrices = { coins: Record<string, { price: number; prices?: { timestamp: number; price: number }[] }> };
type RawLeg = TradeLeg & { coin: string; native: boolean };

const ETH = 'coingecko:ethereum';
const DUST_USD = 1;
const PAGE = 10_000;
const MAX_PAGES = 50;
const WETH = new Set([WETH_ADDRESS, '0x4200000000000000000000000000000000000006'].map((a) => a.toLowerCase()));
const RECEIPT = /^a(?:Eth|Bas)(.+)$/;
const DEBT = /^(?:variable|stable)Debt(?:Eth|Bas)?(.+)$/;

const historyCache = new Map<string, { at: number; data: HistoryResponse }>();
const priceCache = new Map<string, number | null>();
const maxPriceCache = new Map<string, { at: number; max: number | null }>();
let currentCache: { at: number; data: Map<string, number> } | null = null;

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
};

const scan = (url: string): Promise<ScanRow[]> =>
    withRetry(async () => {
        const body = await (await fetch(url)).json() as { message: string; result: ScanRow[] | string | null };
        if (Array.isArray(body.result)) return body.result;
        if (/no transactions found/i.test(body.message)) return [];
        throw new Error(`explorer: ${body.result ?? body.message}`);
    });

// ponytail: single 10k page on mainnet; wallets above that need startblock paging
const etherscan = (action: string, address: string) => {
    const key = process.env.ETH_SCAN_API_KEY;
    if (!key) throw new Error('ETH_SCAN_API_KEY missing in .env');
    return scan(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=1&offset=${PAGE}&sort=asc&apikey=${key}`);
};

// Etherscan's free plan stopped covering Base; alchemy_getAssetTransfers (150 CU per 1000 rows) returns ETH and ERC-20 moves in one stream per direction
const alchemyBase = async (address: string): Promise<{ xfers: Xfer[]; partial: boolean }> => {
    const rpc = process.env.ALCHEMY_RPC_URL?.replace('eth-mainnet', 'base-mainnet');
    if (!rpc) throw new Error('ALCHEMY_RPC_URL missing in .env');
    const seen = new Set<string>();
    const xfers: Xfer[] = [];
    let partial = false;
    await Promise.all(['fromAddress', 'toAddress'].map(async (dir) => {
        let pageKey: string | undefined;
        for (let page = 0; page < MAX_PAGES; page++) {
            const params = { fromBlock: '0x0', toBlock: 'latest', [dir]: address, category: ['external', 'internal', 'erc20'], withMetadata: true, maxCount: '0x3e8', pageKey };
            const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [params] });
            const res = await withRetry(async () => (await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body })).json() as Promise<{ result?: { transfers: AlchemyXfer[]; pageKey?: string }; error?: { message: string } }>);
            if (!res.result) throw new Error(`alchemy: ${res.error?.message}`);
            for (const t of res.result.transfers) {
                if (!t.value || !t.to || seen.has(t.uniqueId)) continue;
                seen.add(t.uniqueId);
                const contract = t.category === 'erc20' ? t.rawContract.address?.toLowerCase() ?? null : null;
                if (t.category === 'erc20' && !contract) continue;
                xfers.push({ chain: 'base', hash: t.hash, ts: Math.floor(Date.parse(t.metadata.blockTimestamp) / 1000), from: t.from, to: t.to, amount: t.value, symbol: contract ? t.asset || contract.slice(0, 6) : 'ETH', contract });
            }
            pageKey = res.result.pageKey;
            if (!pageKey) return;
        }
        partial = true;
    }));
    return { xfers, partial };
};

const ethRows = (rows: ScanRow[], chain: Chain): Xfer[] =>
    rows
        .filter((r) => r.isError === '0' && r.value !== '0')
        .map((r) => ({ chain, hash: r.hash, ts: Number(r.timeStamp), from: r.from, to: r.to, amount: Number(r.value) / 1e18, symbol: 'ETH', contract: null }));

const tokenRows = (rows: ScanRow[], chain: Chain): Xfer[] =>
    rows
        .map((r) => ({
            chain,
            hash: r.hash,
            ts: Number(r.timeStamp),
            from: r.from,
            to: r.to,
            amount: Number(r.value) / 10 ** Number(r.tokenDecimal || 18),
            symbol: r.tokenSymbol || r.contractAddress!.slice(0, 6),
            contract: r.contractAddress!.toLowerCase()
        }));

const llama = async <T>(path: string): Promise<T> =>
    withRetry(async () => {
        const res = await fetch(`https://coins.llama.fi/${path}`);
        if (!res.ok) throw new Error(`llama ${res.status}`);
        return res.json() as Promise<T>;
    });

// one coarse chart call per 9 coins gives each coin's max price over the wallet's lifetime: enough to drop dust before exact lookups
const maxPrices = async (coins: string[], start: number): Promise<Map<string, number | null>> => {
    const need = coins.filter((c) => Date.now() - (maxPriceCache.get(c)?.at ?? 0) > 3_600_000);
    const period = Math.max(1, Math.ceil((Date.now() / 1000 - start) / 86_400 / 50));
    await Promise.all(chunk(need, 9).map(async (group) => {
        const res = await llama<LlamaPrices>(`chart/${group.join(',')}?start=${start}&span=50&period=${period}d`);
        for (const coin of group) {
            const prices = res.coins[coin]?.prices ?? [];
            maxPriceCache.set(coin, { at: Date.now(), max: prices.length ? Math.max(...prices.map((p) => p.price)) : null });
        }
    }));
    return new Map(coins.map((c) => [c, maxPriceCache.get(c)?.max ?? null]));
};

const historicalPrices = async (pairs: { coin: string; ts: number }[]) => {
    const need = [...new Map(pairs.filter((p) => !priceCache.has(`${p.coin}@${p.ts}`)).map((p) => [`${p.coin}@${p.ts}`, p])).values()];
    await Promise.all(chunk(need, 60).map(async (group) => {
        const req: Record<string, number[]> = {};
        for (const p of group) (req[p.coin] ??= []).push(p.ts);
        const res = await llama<LlamaPrices>(`batchHistorical?coins=${encodeURIComponent(JSON.stringify(req))}&searchWidth=4h`);
        for (const p of group) {
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

const coinOf = (chain: Chain, address: string) => (WETH.has(address.toLowerCase()) ? ETH : `${chain}:${address.toLowerCase()}`);

const toLeg = (x: Xfer, me: string): RawLeg | null => {
    const sign = x.to.toLowerCase() === me ? 1 : -1;
    if (x.contract === null) return { symbol: 'ETH', address: WETH_ADDRESS, coin: ETH, native: true, amount: sign * x.amount, usd: null };
    if (WETH.has(x.contract)) return { symbol: 'ETH', address: WETH_ADDRESS, coin: ETH, native: true, amount: sign * x.amount, usd: null };
    if (DEBT.test(x.symbol)) return null;
    const receipt = RECEIPT.exec(x.symbol);
    return { symbol: receipt ? receipt[1] : x.symbol, address: x.contract, coin: coinOf(x.chain, x.contract), native: !receipt, amount: sign * x.amount, usd: null };
};

const buildFlows = async (address: string): Promise<{ flows: Flow[]; partial: Chain[] }> => {
    const me = address.toLowerCase();
    const [txs, internal, tokens, base, reserves] = await Promise.all([
        etherscan('txlist', address),
        etherscan('txlistinternal', address),
        etherscan('tokentx', address),
        alchemyBase(address),
        loadRawReserves()
    ]);
    const xfers: Xfer[] = [...ethRows([...txs, ...internal], 'ethereum'), ...tokenRows(tokens, 'ethereum'), ...base.xfers];
    const protocol = new Set([SPOKE_ADDRESS, MORPHO_BLUE_ADDRESS, ...reserves.map((r) => r.hub)].map((a) => a.toLowerCase()));
    const borrowed = new Set<string>();
    const flows = new Map<string, { chain: Chain; hash: string; ts: number; legs: Map<string, RawLeg> }>();
    for (const x of xfers) {
        const key = `${x.chain}:${x.hash}`;
        const debt = DEBT.exec(x.symbol);
        if (debt) borrowed.add(`${key}:${debt[1]}`);
        const other = x.from.toLowerCase() === me ? x.to : x.from;
        if (protocol.has(other.toLowerCase()) || x.amount === 0) continue;
        const leg = toLeg(x, me);
        if (!leg) continue;
        const flow = flows.get(key) ?? { chain: x.chain, hash: x.hash, ts: x.ts, legs: new Map() };
        flows.set(key, flow);
        const cur = flow.legs.get(leg.symbol);
        if (!cur) flow.legs.set(leg.symbol, leg);
        else {
            cur.amount += leg.amount;
            if (!cur.native && leg.native) Object.assign(cur, { address: leg.address, coin: leg.coin, native: true });
        }
    }
    for (const [key, f] of flows) for (const symbol of f.legs.keys()) if (borrowed.has(`${key}:${symbol}`)) f.legs.delete(symbol);

    const legs = [...flows.values()].flatMap((f) => [...f.legs.values()].map((l) => ({ ...l, ts: f.ts })));
    const stable = (l: { address: string }) => STABLES.has(l.address.toLowerCase());
    const priced = legs.filter((l) => !stable(l));
    const maxes = await maxPrices([...new Set(priced.map((l) => l.coin))], Math.min(...legs.map((l) => l.ts)));
    const exact = priced.filter((l) => (maxes.get(l.coin) ?? 0) * Math.abs(l.amount) >= DUST_USD);
    await historicalPrices(exact.map((l) => ({ coin: l.coin, ts: l.ts })));

    const valued: Flow[] = [...flows.values()].map((f) => ({
        hash: f.hash,
        chain: f.chain,
        ts: f.ts,
        legs: [...f.legs.values()]
            .map(({ coin, native: _n, ...leg }): TradeLeg => {
                const price = stable(leg) ? 1 : maxes.get(coin) === null ? null : (maxes.get(coin) ?? 0) * Math.abs(leg.amount) < DUST_USD ? 0 : priceCache.get(`${coin}@${f.ts}`) ?? null;
                return { ...leg, usd: price === null ? null : leg.amount * price };
            })
            .filter((l) => l.usd === null || Math.abs(l.usd) >= DUST_USD)
    })).filter((f) => f.legs.some((l) => l.usd !== null));
    return { flows: markBridges(valued), partial: base.partial ? ['base'] : [] };
};

export const getHistory = async (address: string): Promise<HistoryResponse> => {
    const cached = historyCache.get(address);
    if (cached && Date.now() - cached.at < 300_000) return cached.data;
    const { flows, partial } = await buildFlows(address);
    const { assets, events } = runLedger(flows);
    const accs = [...assets.values()];
    const prices = accs.length ? await currentPrices([...new Set(accs.map((a) => coinOf(a.chain, a.address)))]) : new Map<string, number>();
    const tracked = accs
        .map((a) => toTracked(a, prices.get(coinOf(a.chain, a.address)) ?? null))
        .filter((a) => a.qty > 0 || a.soldQty > 0)
        .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0) || Math.abs(b.realizedUsd) - Math.abs(a.realizedUsd));
    const sum = (k: 'boughtUsd' | 'soldUsd' | 'costUsd' | 'valueUsd' | 'realizedUsd' | 'unrealizedUsd') => tracked.reduce((s, a) => s + (a[k] ?? 0), 0);
    const data: HistoryResponse = {
        address,
        assets: tracked,
        events: events.sort((a, b) => b.ts - a.ts),
        summary: { boughtUsd: sum('boughtUsd'), soldUsd: sum('soldUsd'), costUsd: sum('costUsd'), valueUsd: sum('valueUsd'), realizedUsd: sum('realizedUsd'), unrealizedUsd: sum('unrealizedUsd') },
        partial
    };
    historyCache.set(address, { at: Date.now(), data });
    return data;
};
