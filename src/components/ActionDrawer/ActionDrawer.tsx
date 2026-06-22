import { useState } from 'react';
import { Button } from '@/components/Button/Button';
import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { executeAction, labelFor, type ExecStep } from '@/lib/contracts';
import { parseTxError } from '@/lib/errors';
import { fmtToken, fmtUsd } from '@/lib/format';
import { maxAmount, projectAction } from '@/lib/projection';
import { useToast } from '@/lib/toast';
import { useWallet } from '@/lib/wallet';
import type { AccountSummary, ActionKind, ReserveWithUser } from '@shared/types';
import type { ActionTarget } from '@/lib/app';
import { HfChart } from './HfChart';
import styles from './ActionDrawer.module.scss';

type Props = {
    target: ActionTarget | null;
    reserves: ReserveWithUser[];
    account: AccountSummary | null;
    onClose: () => void;
    onSuccess: () => void;
};

export const ActionDrawer = ({ target, reserves, account, onClose, onSuccess }: Props) => {
    const reserve = target ? reserves.find((r) => r.id === target.reserveId) : undefined;
    if (!target || !reserve) return null;
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
                {account ? (
                    <DrawerInner
                        key={`${target.reserveId}-${target.kind}`}
                        reserve={reserve}
                        account={account}
                        initialKind={target.kind}
                        onClose={onClose}
                        onSuccess={onSuccess}
                    />
                ) : (
                    <div className={styles.connect}>Connect your wallet to manage this position.</div>
                )}
            </div>
        </div>
    );
};

const stepLabel = (step: ExecStep | null, symbol: string, action: string): string => {
    if (step === 'approve') return `Approving ${symbol}…`;
    if (step === 'action') return `${action}…`;
    return action;
};

type InnerProps = {
    reserve: ReserveWithUser;
    account: AccountSummary;
    initialKind: ActionKind;
    onClose: () => void;
    onSuccess: () => void;
};

const DrawerInner = ({ reserve, account, initialKind, onClose, onSuccess }: InnerProps) => {
    const { getSigner } = useWallet();
    const { toast } = useToast();
    const [kind, setKind] = useState<ActionKind>(initialKind);
    const [amount, setAmount] = useState('');
    const [isMax, setIsMax] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState<ExecStep | null>(null);
    const [hash, setHash] = useState<string | null>(null);

    const tabs: ActionKind[] = reserve.borrowable ? ['supply', 'withdraw', 'borrow', 'repay'] : ['supply', 'withdraw'];
    const max = maxAmount(account, reserve, kind);
    const amountNum = Number(amount) || 0;
    const projection = projectAction(account, reserve, kind, amountNum);
    const maxDecimals = Math.min(reserve.decimals, 8);
    const fmtAmt = (n: number) => (n <= 0 ? '' : n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals, useGrouping: false }));

    const context: Record<ActionKind, { label: string; value: number }> = {
        supply: { label: 'Wallet balance', value: reserve.walletBalance },
        withdraw: { label: 'Supplied', value: reserve.supplied },
        borrow: { label: 'Available to borrow', value: max },
        repay: { label: 'Your debt', value: reserve.debt }
    };

    const willLiquidate = projection.healthFactor !== null && projection.healthFactor < 1;
    const exceeds = amountNum > max + 1e-9;
    const invalid = amountNum <= 0 || exceeds || willLiquidate;
    const needsApproval = (kind === 'supply' || kind === 'repay') && reserve.allowance < amountNum;

    const onPickKind = (k: ActionKind) => {
        setKind(k);
        setAmount('');
        setIsMax(false);
    };

    const onInput = (v: string) => {
        if (/^\d*\.?\d*$/.test(v)) {
            setAmount(v);
            setIsMax(false);
        }
    };

    const onSlider = (pct: number) => {
        setAmount(fmtAmt((max * pct) / 100));
        setIsMax(pct >= 100);
    };

    const submit = async () => {
        setSubmitting(true);
        try {
            const signer = await getSigner();
            const tx = await executeAction({ signer, account: account.address, reserve, kind, amount, isMax, onStep: setStep });
            setHash(tx);
            toast(`${labelFor[kind]} successful`, 'success');
            onSuccess();
        } catch (e) {
            toast(parseTxError(e), 'error');
        } finally {
            setSubmitting(false);
            setStep(null);
        }
    };

    const sliderPct = max > 0 ? Math.min(100, Math.round((amountNum / max) * 100)) : 0;
    const showChart = (account.debtUsd > 0 || kind === 'borrow') && max > 0;

    if (hash) {
        return (
            <div className={styles.success}>
                <div className={styles.check}>✓</div>
                <h2>{labelFor[kind]} complete</h2>
                <p>Your position has been updated.</p>
                <a className={styles.txlink} href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
                    View on Etherscan ↗
                </a>
                <Button block size="lg" onClick={onClose}>
                    Done
                </Button>
            </div>
        );
    }

    return (
        <div className={styles.inner}>
            <div className={styles.header}>
                <div className={styles.asset}>
                    <TokenIcon symbol={reserve.symbol} address={reserve.underlying} size={40} />
                    <div>
                        <div className={styles.symbol}>{reserve.symbol}</div>
                        <div className={styles.price}>{fmtUsd(reserve.priceUsd)}</div>
                    </div>
                </div>
                <button className={styles.close} onClick={onClose} aria-label="Close">
                    ✕
                </button>
            </div>

            <div className={styles.tabs}>
                {tabs.map((k) => (
                    <button
                        key={k}
                        className={[styles.tab, kind === k ? styles.tabActive : ''].join(' ')}
                        onClick={() => onPickKind(k)}
                    >
                        {labelFor[k]}
                    </button>
                ))}
            </div>

            <div className={styles.inputBlock}>
                <div className={styles.inputRow}>
                    <input
                        className={styles.input}
                        inputMode="decimal"
                        placeholder="0.0"
                        value={amount}
                        onChange={(e) => onInput(e.target.value)}
                        autoFocus
                    />
                    <button className={styles.maxBtn} onClick={() => onSlider(100)}>
                        MAX
                    </button>
                </div>
                <div className={styles.inputMeta}>
                    <span>{amountNum > 0 ? fmtUsd(amountNum * reserve.priceUsd) : '$0.00'}</span>
                    <span>
                        {context[kind].label}: {fmtToken(context[kind].value)} {reserve.symbol}
                    </span>
                </div>
            </div>

            <input
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                value={sliderPct}
                onChange={(e) => onSlider(Number(e.target.value))}
            />
            <div className={styles.ticks}>
                {[0, 25, 50, 75, 100].map((p) => (
                    <button key={p} className={styles.tick} onClick={() => onSlider(p)}>
                        {p}%
                    </button>
                ))}
            </div>

            {showChart && (
                <div className={styles.chart}>
                    <div className={styles.chartHead}>
                        <span>Health factor projection</span>
                        <HealthBadge hf={account.healthFactor} projected={projection.healthFactor} />
                    </div>
                    <HfChart account={account} reserve={reserve} kind={kind} max={max} amount={amountNum} />
                </div>
            )}

            <div className={styles.summary}>
                <Row label="Health factor" value={<HealthBadge hf={account.healthFactor} projected={amountNum > 0 ? projection.healthFactor : undefined} />} />
                <Row label="Net worth" value={fmtUsd(amountNum > 0 ? projection.netWorthUsd : account.netWorthUsd)} />
                <Row label="Available to borrow" value={fmtUsd(amountNum > 0 ? projection.availableBorrowsUsd : account.availableBorrowsUsd)} />
            </div>

            {willLiquidate && <div className={styles.error}>This would put your position below the liquidation threshold.</div>}

            <Button block size="lg" variant="primary" disabled={invalid} loading={submitting} onClick={submit}>
                {submitting ? stepLabel(step, reserve.symbol, labelFor[kind]) : exceeds ? 'Exceeds maximum' : labelFor[kind]}
            </Button>
            {needsApproval && !submitting && !invalid && <div className={styles.note}>Includes a one-time token approval</div>}
        </div>
    );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className={styles.row}>
        <span>{label}</span>
        <span className={styles.rowValue}>{value}</span>
    </div>
);
