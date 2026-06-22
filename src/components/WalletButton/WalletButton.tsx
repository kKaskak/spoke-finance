import { useState } from 'react';
import { Button } from '@/components/Button/Button';
import { shortAddress } from '@/lib/format';
import { useWallet } from '@/lib/wallet';
import styles from './WalletButton.module.scss';

export const WalletButton = () => {
    const { account, hasWallet, connecting, isWrongChain, connect, disconnect, switchChain } = useWallet();
    const [err, setErr] = useState<string | null>(null);

    const onConnect = () => {
        setErr(null);
        connect().catch((e) => setErr(e.message));
    };

    if (!hasWallet) {
        return (
            <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                    Install Wallet
                </Button>
            </a>
        );
    }

    if (!account) {
        return (
            <div className={styles.wrap}>
                <Button size="sm" onClick={onConnect} loading={connecting}>
                    Connect
                </Button>
                {err && <span className={styles.err}>{err}</span>}
            </div>
        );
    }

    if (isWrongChain) {
        return (
            <Button variant="danger" size="sm" onClick={() => switchChain().catch(() => {})}>
                Switch to Ethereum
            </Button>
        );
    }

    return (
        <button className={styles.pill} onClick={disconnect} title="Disconnect">
            <span className={styles.dot} />
            {shortAddress(account)}
        </button>
    );
};
