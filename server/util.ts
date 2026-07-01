import { ethers } from 'ethers';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRANSIENT =
    /429|compute units|rate limit|throughput|missing revert data|CALL_EXCEPTION|SERVER_ERROR|TIMEOUT|could not coalesce|bad result|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|502|503|504/i;

const isTransient = (e: unknown): boolean => {
    const err = e as { code?: string; message?: string; info?: { error?: { code?: number } } };
    if (err?.info?.error?.code === 429) return true;
    return TRANSIENT.test(`${err?.code ?? ''} ${String(err?.message ?? e)}`);
};

export const withRetry = async <T>(fn: () => Promise<T>, tries = 3): Promise<T> => {
    for (let i = 0; ; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i >= tries - 1 || !isTransient(e)) throw e;
            await sleep(150 * 2 ** i);
        }
    }
};

export const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> => {
    const out: R[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await withRetry(() => fn(items[i], i));
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
};

const SYMBOL_SELECTOR = '0x95d89b41';

// ponytail: a few legacy tokens (e.g. MKR) return symbol() as bytes32 instead of string; fall back to decode both ways
export const resilientSymbol = async (provider: { call: (tx: { to: string; data: string }) => Promise<string> }, address: string): Promise<string> => {
    const raw = await withRetry(() => provider.call({ to: address, data: SYMBOL_SELECTOR }));
    try {
        return ethers.AbiCoder.defaultAbiCoder().decode(['string'], raw)[0] as string;
    } catch {
        try {
            return ethers.decodeBytes32String(raw);
        } catch {
            return address.slice(0, 6);
        }
    }
};
