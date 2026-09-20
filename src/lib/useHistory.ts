import { useEffect, useState } from 'react';
import type { HistoryResponse } from '@shared/types';
import { fetchHistory } from './api';

type State = { address: string | null; data: HistoryResponse | null; error: string | null };

export const useHistory = (address: string | null) => {
    const [state, setState] = useState<State>({ address: null, data: null, error: null });

    useEffect(() => {
        if (!address) return;
        let active = true;
        fetchHistory(address)
            .then((data) => active && setState({ address, data, error: null }))
            .catch((e) => active && setState({ address, data: null, error: e.message }));
        return () => {
            active = false;
        };
    }, [address]);

    const current = state.address === address;
    return { data: current ? state.data : null, error: current ? state.error : null, loading: !!address && !current };
};
