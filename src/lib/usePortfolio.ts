import { useCallback, useEffect, useState } from 'react';
import type { AccountSummary, Reserve, ReserveWithUser } from '@shared/types';
import { fetchPosition, fetchReserves } from './api';
import { useWallet } from './wallet';

export const zeroUser = (r: Reserve): ReserveWithUser => ({
    ...r,
    supplied: 0,
    suppliedUsd: 0,
    debt: 0,
    debtUsd: 0,
    isCollateral: false,
    isBorrowed: false,
    walletBalance: 0,
    walletBalanceUsd: 0,
    allowance: 0
});

export type Portfolio = {
    connected: boolean;
    account: AccountSummary | null;
    reserves: ReserveWithUser[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

export const usePortfolio = (): Portfolio => {
    const { account: address } = useWallet();
    const [reserves, setReserves] = useState<ReserveWithUser[]>([]);
    const [account, setAccount] = useState<AccountSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        let active = true;
        setError(null);
        if (reserves.length === 0) setLoading(true);

        const load = async () => {
            if (address) {
                const data = await fetchPosition(address);
                if (!active) return;
                setReserves(data.reserves);
                setAccount(data.account);
            } else {
                const data = await fetchReserves();
                if (!active) return;
                setReserves(data.map(zeroUser));
                setAccount(null);
            }
        };

        load()
            .catch((e) => active && setError(e.message))
            .finally(() => active && setLoading(false));

        const poll = () => { if (!document.hidden) load(); };
        const id = setInterval(poll, 60_000);
        const onVisible = () => { if (!document.hidden) load(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            active = false;
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, tick]);

    return { connected: !!address, account, reserves, loading, error, refresh };
};
