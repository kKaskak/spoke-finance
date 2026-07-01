import { ethers } from 'ethers';
import { getProvider } from './chain';
import { withRetry } from './util';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])'
];
let _mc: ethers.Contract | undefined;
const mc = () => (_mc ??= new ethers.Contract(MULTICALL3, MULTICALL3_ABI, getProvider()));

export type Call = {
    target: string;
    iface: ethers.Interface;
    method: string;
    args?: unknown[];
    decode?: (data: string) => unknown;
};

const CHUNK = 80;

const unwrap = (r: ethers.Result): unknown => (r.length === 1 ? r[0] : r);

const runChunk = async (slice: Call[]): Promise<unknown[]> => {
    const encoded = slice.map((c) => ({
        target: c.target,
        allowFailure: true,
        callData: c.iface.encodeFunctionData(c.method, c.args ?? [])
    }));
    const res: { success: boolean; returnData: string }[] = await withRetry(() => mc().aggregate3(encoded));
    return slice.map((c, j) => {
        const r = res[j];
        if (!r.success || r.returnData === '0x') throw new Error(`multicall: ${c.method} on ${c.target} failed`);
        if (c.decode) return c.decode(r.returnData);
        return unwrap(c.iface.decodeFunctionResult(c.method, r.returnData));
    });
};

// a failed sub-call fails the whole load: better a visible error than a fabricated zero balance
export const multicall = async (calls: Call[]): Promise<unknown[]> => {
    const chunks: Call[][] = [];
    for (let i = 0; i < calls.length; i += CHUNK) chunks.push(calls.slice(i, i + CHUNK));
    return (await Promise.all(chunks.map(runChunk))).flat();
};
