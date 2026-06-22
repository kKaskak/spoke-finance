import { getAddress } from 'ethers';
import { useState } from 'react';
import styles from './TokenIcon.module.scss';

type Props = {
    symbol: string;
    address: string;
    size?: number;
};

const url = (address: string) => {
    try {
        return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${getAddress(
            address
        )}/logo.png`;
    } catch {
        return '';
    }
};

export const TokenIcon = ({ symbol, address, size = 36 }: Props) => {
    const [failed, setFailed] = useState(false);
    const src = url(address);
    const dims = { width: size, height: size };

    if (failed || !src) {
        return (
            <div className={styles.fallback} style={{ ...dims, fontSize: size * 0.36 }}>
                {symbol.slice(0, 3)}
            </div>
        );
    }
    return (
        <img
            className={styles.icon}
            style={dims}
            src={src}
            alt={symbol}
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
};
