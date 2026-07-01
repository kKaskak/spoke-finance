import type { OtherMarketsResponse, OtherPositionsResponse, PositionResponse, Reserve } from '@shared/types';

const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(path);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
};

export const fetchReserves = () => get<Reserve[]>('/api/reserves');
export const fetchPosition = (address: string) => get<PositionResponse>(`/api/position/${address}`);
export const fetchOtherMarkets = () => get<OtherMarketsResponse>('/api/other-markets');
export const fetchOtherPositions = (address: string) => get<OtherPositionsResponse>(`/api/other-positions/${address}`);
