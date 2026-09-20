import { getAddress, isAddress } from 'ethers';
import { X } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/Button/Button';
import { Card } from '@/components/Card/Card';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import { StatTile } from '@/components/StatTile/StatTile';
import { WalletButton } from '@/components/WalletButton/WalletButton';
import { fmtPct, fmtSignedUsd, fmtUsd, shortAddress } from '@/lib/format';
import { Reveal } from '@/lib/motion';
import { removeWallet, saveWallet, useSavedWallets } from '@/lib/savedWallets';
import { useHistory } from '@/lib/useHistory';
import { useWallet } from '@/lib/wallet';
import { ActivityList } from './components/ActivityList';
import { AssetTable } from './components/AssetTable';
import styles from './Tracker.module.scss';

type ChipProps = { label: string; address: string; active: boolean; removable?: boolean };

const Chip = ({ label, address, active, removable }: ChipProps) => {
    const onRemove = () => removeWallet(address);
    return (
        <span className={[styles.chip, active ? styles.chipActive : ''].join(' ')}>
            <Link to={`/tracker/${address}`} className={styles.chipLink}>
                <span className={styles.chipLabel}>{label}</span>
                <span className={styles.chipAddr}>{shortAddress(address)}</span>
            </Link>
            {removable && (
                <button type="button" className={styles.chipRemove} onClick={onRemove} aria-label={`Remove ${label}`}>
                    <X size={12} />
                </button>
            )}
        </span>
    );
};

const TrackerSkeleton = () => (
    <>
        <div className={styles.stats}>
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className={styles.statSkeleton}>
                    <Skeleton width={90} height={14} />
                    <Skeleton width={140} height={34} />
                    <Skeleton width={110} height={12} />
                </div>
            ))}
        </div>
        <Card title="Assets">
            {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={52} className={styles.rowSkeleton} />
            ))}
        </Card>
    </>
);

const tone = (n: number) => (n > 0 ? styles.pos : n < 0 ? styles.neg : undefined);

export const Tracker = () => {
    const { address: param } = useParams();
    const { account } = useWallet();
    const navigate = useNavigate();
    const saved = useSavedWallets();
    const address = param ? (isAddress(param) ? getAddress(param) : null) : account;
    const { data, error, loading } = useHistory(address);
    const [input, setInput] = useState('');
    const [label, setLabel] = useState('');
    const [selected, setSelected] = useState<string | null>(null);

    const onInput = (e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value);
    const onLabel = (e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
    const onView = (e: FormEvent) => {
        e.preventDefault();
        const next = input.trim();
        if (!isAddress(next)) return;
        setInput('');
        setSelected(null);
        navigate(`/tracker/${getAddress(next)}`);
    };
    const onSave = (e: FormEvent) => {
        e.preventDefault();
        if (!address) return;
        saveWallet(address, label.trim() || shortAddress(address));
        setLabel('');
    };
    const onClearSelected = () => setSelected(null);

    const isSaved = !!address && saved.some((w) => w.address === address);
    const events = data && selected ? data.events.filter((e) => e.legs.some((l) => l.symbol === selected)) : data?.events ?? [];
    const summary = data?.summary;
    const totalPnl = summary ? summary.realizedUsd + summary.unrealizedUsd : 0;

    return (
        <div className={styles.page}>
            <div className={styles.head}>
                <h1 className={styles.title}>Tracker</h1>
                <p className={styles.subtitle}>
                    Buys, sells, average prices and profit for any address on Ethereum and Base. View-only, no signature needed.
                </p>
            </div>

            <Card>
                <form className={styles.lookup} onSubmit={onView}>
                    <input
                        className={styles.input}
                        placeholder="Paste an address 0x…"
                        value={input}
                        onChange={onInput}
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <Button type="submit" disabled={!isAddress(input.trim())}>
                        View
                    </Button>
                </form>
                {(account || saved.length > 0 || (address && !isSaved)) && (
                    <div className={styles.chips}>
                        {account && <Chip label="Connected" address={account} active={address === account} />}
                        {saved.map((w) => (
                            <Chip key={w.address} label={w.label} address={w.address} active={address === w.address} removable />
                        ))}
                        {address && !isSaved && address !== account && (
                            <form className={styles.saveForm} onSubmit={onSave}>
                                <input className={styles.labelInput} placeholder="Label" value={label} onChange={onLabel} />
                                <Button type="submit" variant="secondary" size="sm">
                                    Save wallet
                                </Button>
                            </form>
                        )}
                    </div>
                )}
            </Card>

            {!address && !param && (
                <div className={styles.empty}>
                    <Reveal>
                        <h2 className={styles.emptyTitle}>Whose trades?</h2>
                    </Reveal>
                    <Reveal delay={0.06}>
                        <p className={styles.emptySub}>Paste an address above, or connect your wallet to track your own.</p>
                    </Reveal>
                    <Reveal delay={0.12}>
                        <WalletButton />
                    </Reveal>
                </div>
            )}

            {param && !address && (
                <Card title="Invalid address">
                    <p className={styles.errText}>{param} is not a valid address.</p>
                </Card>
            )}

            {error && (
                <Card title="Something went wrong">
                    <p className={styles.errText}>{error}</p>
                </Card>
            )}

            {address && !error && (loading || !data || !summary ? (
                <TrackerSkeleton />
            ) : (
                <>
                    <Reveal className={styles.stats}>
                        <StatTile label="Tracked value" value={fmtUsd(summary.valueUsd)} sub={`Cost basis ${fmtUsd(summary.costUsd)}`} />
                        <StatTile
                            label="Realized P&L"
                            value={<span className={tone(summary.realizedUsd)}>{fmtSignedUsd(summary.realizedUsd)}</span>}
                            sub={`Sold ${fmtUsd(summary.soldUsd, true)} in total`}
                        />
                        <StatTile
                            label="Unrealized P&L"
                            value={<span className={tone(summary.unrealizedUsd)}>{fmtSignedUsd(summary.unrealizedUsd)}</span>}
                            sub={`Bought ${fmtUsd(summary.boughtUsd, true)} in total`}
                        />
                        <StatTile
                            label="Total P&L"
                            value={<span className={tone(totalPnl)}>{fmtSignedUsd(totalPnl)}</span>}
                            sub={summary.boughtUsd > 0 ? `${fmtPct(totalPnl / summary.boughtUsd)} of amount bought` : '—'}
                        />
                    </Reveal>
                    <p className={styles.caption}>
                        Ethereum and Base combined, average cost method. Deposits, borrows and repayments on Aave and Morpho are not
                        trades; swaps, transfers in and transfers out are. Transfers are priced at market at the time, and bridges between the
                        two chains are matched and ignored.
                        {data.partial.length > 0 && ' Base history is partial: this address has more token transfers than one scan covers.'}
                    </p>
                    <Card title="Assets" pad={false}>
                        {data.assets.length === 0 ? (
                            <p className={styles.mutedPad}>No priced trades found for this address.</p>
                        ) : (
                            <AssetTable assets={data.assets} selected={selected} onSelect={setSelected} />
                        )}
                    </Card>
                    <Card
                        title={selected ? `${selected} activity` : 'Activity'}
                        pad={false}
                        action={
                            selected && (
                                <button type="button" className={styles.toggleLink} onClick={onClearSelected}>
                                    Show all
                                </button>
                            )
                        }
                    >
                        <ActivityList key={selected ?? 'all'} events={events} />
                    </Card>
                </>
            ))}
        </div>
    );
};
