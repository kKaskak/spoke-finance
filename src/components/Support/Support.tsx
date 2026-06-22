import { parseEther } from 'ethers';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button/Button';
import { parseTxError } from '@/lib/errors';
import { shortAddress } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { useWallet } from '@/lib/wallet';
import styles from './Support.module.scss';

const ADDRESS = '0x7f7cc6346734E96642A339d09bD209459B555442';
const PRESETS = ['0.01', '0.05', '0.1'];

const Heart = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
);

export const Support = () => {
    const { account, connect, getSigner } = useWallet();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('0.05');
    const [sending, setSending] = useState(false);
    const [hash, setHash] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const close = () => {
        setOpen(false);
        setHash(null);
        setAmount('0.05');
    };

    const onInput = (v: string) => {
        if (/^\d*\.?\d*$/.test(v)) setAmount(v);
    };

    const copy = () => {
        navigator.clipboard.writeText(ADDRESS).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    const send = async () => {
        setSending(true);
        try {
            if (!account) await connect();
            const signer = await getSigner();
            const tx = await signer.sendTransaction({ to: ADDRESS, value: parseEther(amount), gasLimit: 21000n });
            await tx.wait();
            setHash(tx.hash);
            toast('Thank you for your support', 'success');
        } catch (e) {
            toast(parseTxError(e), 'error');
        } finally {
            setSending(false);
        }
    };

    const invalid = !(Number(amount) > 0);

    return (
        <>
            <button className={styles.trigger} onClick={() => setOpen(true)}>
                <Heart />
                <span className={styles.triggerText}>Support</span>
            </button>

            {open && createPortal(
                <div className={styles.overlay} onClick={close}>
                    <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.close} onClick={close} aria-label="Close">
                            ✕
                        </button>

                        {hash ? (
                            <div className={styles.success}>
                                <div className={styles.badge}>
                                    <Heart />
                                </div>
                                <h2>Thank you</h2>
                                <p>Your support keeps this portal alive.</p>
                                <a className={styles.txlink} href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
                                    View on Etherscan ↗
                                </a>
                                <Button block size="lg" onClick={close}>
                                    Done
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className={styles.badge}>
                                    <Heart />
                                </div>
                                <h2 className={styles.title}>Support the project</h2>
                                <p className={styles.sub}>
                                    If this portal is useful, send a tip to keep it maintained. Every bit helps.
                                </p>

                                <div className={styles.presets}>
                                    {PRESETS.map((p) => (
                                        <button
                                            key={p}
                                            className={[styles.chip, amount === p ? styles.chipActive : ''].join(' ')}
                                            onClick={() => setAmount(p)}
                                        >
                                            {p} ETH
                                        </button>
                                    ))}
                                </div>

                                <div className={styles.inputRow}>
                                    <input
                                        className={styles.input}
                                        inputMode="decimal"
                                        placeholder="0.0"
                                        value={amount}
                                        onChange={(e) => onInput(e.target.value)}
                                    />
                                    <span className={styles.unit}>ETH</span>
                                </div>

                                <button className={styles.address} onClick={copy} title="Copy address">
                                    <span className={styles.addressLabel}>To</span>
                                    <span className={styles.addressValue}>{shortAddress(ADDRESS)}</span>
                                    <span className={styles.copy}>{copied ? 'Copied' : 'Copy'}</span>
                                </button>

                                <Button block size="lg" loading={sending} disabled={invalid} onClick={send}>
                                    {account ? `Send ${amount || '0'} ETH` : 'Connect & Send'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
