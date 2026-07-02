import { useEffect, useState } from 'react';

const LIDO_APR_URL = 'https://eth-api.lido.fi/v1/protocol/steth/apr/sma';

let cached: number | null = null;

export const useLidoApr = (): number => {
    const [apr, setApr] = useState(cached ?? 0);

    useEffect(() => {
        if (cached !== null) return;
        fetch(LIDO_APR_URL)
            .then((res) => res.json())
            .then((json) => {
                cached = (json.data.smaApr as number) / 100;
                setApr(cached);
            })
            .catch(() => {});
    }, []);

    return apr;
};
