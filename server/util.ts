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

// ponytail: a few legacy tokens (e.g. MKR) return symbol() as bytes32 instead of string; fall back to decode both ways
export const decodeSymbol = (data: string, fallback: string): string => {
    if (!data || data === '0x') return fallback;
    try {
        return ethers.AbiCoder.defaultAbiCoder().decode(['string'], data)[0] as string;
    } catch {
        try {
            return ethers.decodeBytes32String(data);
        } catch {
            return fallback;
        }
    }
};
