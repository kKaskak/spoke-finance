import { useEffect, useState } from 'react';
import type { AccountSummary, PlatformSummary, ReserveWithUser } from '@shared/types';
import { fetchOtherMarkets, fetchOtherPositions } from './api';
import { zeroUser } from './usePortfolio';
import { useWallet } from './wallet';

const emptySummary = (platform: 'morpho' | 'fluid', label: string): PlatformSummary => ({
    platform,
    label,
    collateralUsd: 0,
    debtUsd: 0,
    healthFactor: null,
    markets: [],
    positions: []
});

export type OtherPlatforms = {
    aaveV3Reserves: ReserveWithUser[];
    aaveV3Account: AccountSummary | null;
    morpho: PlatformSummary;
    fluid: PlatformSummary;
    loading: boolean;
    error: string | null;
};

export const usePlatforms = (): OtherPlatforms => {
    const { account: address } = useWallet();
    const [state, setState] = useState<Omit<OtherPlatforms, 'loading' | 'error'>>({
        aaveV3Reserves: [],
        aaveV3Account: null,
        morpho: emptySummary('morpho', 'Morpho'),
        fluid: emptySummary('fluid', 'Fluid')
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const load = async () => {
            if (address) {
                const data = await fetchOtherPositions(address);
                if (!active) return;
                setState({
                    aaveV3Reserves: data.aaveV3?.reserves ?? [],
                    aaveV3Account: data.aaveV3?.account ?? null,
                    morpho: data.morpho ?? emptySummary('morpho', 'Morpho'),
                    fluid: data.fluid ?? emptySummary('fluid', 'Fluid')
                });
            } else {
                const data = await fetchOtherMarkets();
                if (!active) return;
                setState({
                    aaveV3Reserves: (data.aaveV3 ?? []).map(zeroUser),
                    aaveV3Account: null,
                    morpho: { ...emptySummary('morpho', 'Morpho'), markets: data.morpho ?? [] },
                    fluid: { ...emptySummary('fluid', 'Fluid'), markets: data.fluid ?? [] }
                });
            }
        };

        load()
            .catch((e) => active && setError(e.message))
            .finally(() => active && setLoading(false));

        const id = setInterval(load, 30_000);
        return () => {
            active = false;
            clearInterval(id);
        };
    }, [address]);

    return { ...state, loading, error };
};
