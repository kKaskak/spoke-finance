import { ethers } from 'ethers';
import { provider } from './chain';
import { withRetry } from './util';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])'
];
const mc = new ethers.Contract(MULTICALL3, MULTICALL3_ABI, provider);

export type Call = {
    target: string;
    iface: ethers.Interface;
    method: string;
    args?: unknown[];
    decode?: (data: string) => unknown;
};

const CHUNK = 80;

const unwrap = (r: ethers.Result): unknown => (r.length === 1 ? r[0] : r);

export const multicall = async (calls: Call[]): Promise<(unknown | null)[]> => {
    const out: (unknown | null)[] = [];
    for (let i = 0; i < calls.length; i += CHUNK) {
        const slice = calls.slice(i, i + CHUNK);
        const encoded = slice.map((c) => ({
            target: c.target,
            allowFailure: true,
            callData: c.iface.encodeFunctionData(c.method, c.args ?? [])
        }));
        const res: { success: boolean; returnData: string }[] = await withRetry(() => mc.aggregate3(encoded));
        slice.forEach((c, j) => {
            const r = res[j];
            if (c.decode) {
                out.push(c.decode(r.returnData));
                return;
            }
            if (!r.success || r.returnData === '0x') {
                out.push(null);
                return;
            }
            out.push(unwrap(c.iface.decodeFunctionResult(c.method, r.returnData)));
        });
    }
    return out;
};

// legacy tokens (e.g. MKR) return symbol() as bytes32 instead of string
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
