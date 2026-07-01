import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { AnimatedTabs } from '@/components/AnimatedTabs/AnimatedTabs';
import { Button } from '@/components/Button/Button';
import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { FLUID_NATIVE_ETH } from '@shared/constants';
import type { ActionTarget, PairPlatform, PooledPlatform } from '@/lib/app';
import {
    executeAaveV3Action,
    executeAction,
    executeFluidAction,
    executeMorphoAction,
    labelFor,
    type ExecStep
} from '@/lib/contracts';
import { parseTxError } from '@/lib/errors';
import { fmtToken, fmtUsd } from '@/lib/format';
import { maxAmount, maxPairAmount, projectAction, projectPairAction } from '@/lib/projection';
import type { OtherPlatforms } from '@/lib/usePlatforms';
import type { Portfolio } from '@/lib/usePortfolio';
import { useToast } from '@/lib/toast';
import { useWallet } from '@/lib/wallet';
import type { AccountSummary, ActionKind, PairMarket, PairPosition, ReserveWithUser } from '@shared/types';
import { HfChart } from './HfChart';
import styles from './ActionDrawer.module.scss';

type Props = {
    target: ActionTarget | null;
    portfolio: Portfolio;
    otherPlatforms: OtherPlatforms;
    onClose: () => void;
    onSuccess: () => void;
};

const isPooledTarget = (t: ActionTarget): t is Extract<ActionTarget, { platform: PooledPlatform }> =>
    t.platform === 'aave-v4' || t.platform === 'aave-v3';

export const ActionDrawer = ({ target, portfolio, otherPlatforms, onClose, onSuccess }: Props) => {
    if (!target) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <motion.div
                layout
                transition={{ layout: { type: 'spring', stiffness: 420, damping: 40 } }}
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                {isPooledTarget(target) ? (
                    <PooledDrawer
                        target={target}
                        portfolio={portfolio}
                        otherPlatforms={otherPlatforms}
                        onClose={onClose}
                        onSuccess={onSuccess}
                    />
                ) : (
                    <PairDrawer target={target} otherPlatforms={otherPlatforms} onClose={onClose} onSuccess={onSuccess} />
                )}
            </motion.div>
        </div>
    );
};

const stepLabel = (step: ExecStep | null, symbol: string, action: string): string => {
    if (step === 'approve') return `Approving ${symbol}…`;
    if (step === 'action') return `${action}…`;
    return action;
};

// --- Aave v4 / v3 (pooled account) ---

type PooledDrawerProps = {
    target: { platform: PooledPlatform; kind: ActionKind; reserveId: number };
    portfolio: Portfolio;
    otherPlatforms: OtherPlatforms;
    onClose: () => void;
    onSuccess: () => void;
};

const PooledDrawer = ({ target, portfolio, otherPlatforms, onClose, onSuccess }: PooledDrawerProps) => {
    const reserves = target.platform === 'aave-v4' ? portfolio.reserves : otherPlatforms.aaveV3Reserves;
    const account = target.platform === 'aave-v4' ? portfolio.account : otherPlatforms.aaveV3Account;
    const reserve = reserves.find((r) => r.id === target.reserveId);
    if (!reserve) return null;
    return account ? (
        <PooledDrawerInner
            key={`${target.platform}-${target.reserveId}-${target.kind}`}
            platform={target.platform}
            reserve={reserve}
            account={account}
            initialKind={target.kind}
            onClose={onClose}
            onSuccess={onSuccess}
        />
    ) : (
        <div className={styles.connect}>Connect your wallet to manage this position.</div>
    );
};

type PooledInnerProps = {
    platform: PooledPlatform;
    reserve: ReserveWithUser;
    account: AccountSummary;
    initialKind: ActionKind;
    onClose: () => void;
    onSuccess: () => void;
};

const PooledDrawerInner = ({ platform, reserve, account, initialKind, onClose, onSuccess }: PooledInnerProps) => {
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
            const exec = platform === 'aave-v4' ? executeAction : executeAaveV3Action;
            const tx = await exec({ signer, account: account.address, reserve, kind, amount, isMax, onStep: setStep });
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

            <div className={styles.tabsWrap}>
                <AnimatedTabs
                    tabs={tabs.map((k) => ({ value: k, label: labelFor[k] }))}
                    active={kind}
                    onChange={onPickKind}
                    layoutId="pooledDrawerTab"
                    fullWidth
                />
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
                style={{ '--fill': `${sliderPct}%` } as React.CSSProperties}
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

// --- Morpho / Fluid (isolated market position) ---

type PairDrawerProps = {
    target: { platform: PairPlatform; kind: ActionKind; marketId: string };
    otherPlatforms: OtherPlatforms;
    onClose: () => void;
    onSuccess: () => void;
};

const PairDrawer = ({ target, otherPlatforms, onClose, onSuccess }: PairDrawerProps) => {
    const { account } = useWallet();
    const summary = otherPlatforms[target.platform];
    const market = summary.markets.find((m) => m.id === target.marketId);
    const position = summary.positions.find((p) => p.marketId === target.marketId);
    if (!market) return null;
    return account ? (
        <PairDrawerInner
            key={`${target.platform}-${target.marketId}-${target.kind}`}
            platform={target.platform}
            market={market}
            position={position}
            initialKind={target.kind}
            onClose={onClose}
            onSuccess={onSuccess}
        />
    ) : (
        <div className={styles.connect}>Connect your wallet to manage this position.</div>
    );
};

type PairInnerProps = {
    platform: PairPlatform;
    market: PairMarket;
    position: PairPosition | undefined;
    initialKind: ActionKind;
    onClose: () => void;
    onSuccess: () => void;
};

const PairDrawerInner = ({ platform, market, position, initialKind, onClose, onSuccess }: PairInnerProps) => {
    const { account: address, getSigner } = useWallet();
    const { toast } = useToast();
    const [kind, setKind] = useState<ActionKind>(initialKind);
    const [amount, setAmount] = useState('');
    const [isMax, setIsMax] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState<ExecStep | null>(null);
    const [hash, setHash] = useState<string | null>(null);

    const isSupplySide = kind === 'supply' || kind === 'withdraw';
    const symbol = isSupplySide ? market.supplySymbol : market.borrowSymbol;
    const decimals = isSupplySide ? market.supplyDecimals : market.borrowDecimals;
    const price = isSupplySide ? market.supplyPriceUsd : market.borrowPriceUsd;
    const max = maxPairAmount(market, position, kind, kind === 'supply' || kind === 'repay' ? walletBalance : 0);
    const amountNum = Number(amount) || 0;
    const projection = projectPairAction(market, position, kind, amountNum);
    const maxDecimals = Math.min(decimals, 8);
    const fmtAmt = (n: number) => (n <= 0 ? '' : n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals, useGrouping: false }));

    const context: Record<ActionKind, { label: string; value: number }> = {
        supply: { label: 'Wallet balance', value: walletBalance },
        withdraw: { label: 'Supplied', value: position?.supplied ?? 0 },
        borrow: { label: 'Available to borrow', value: max },
        repay: { label: 'Your debt', value: position?.debt ?? 0 }
    };

    const willLiquidate = projection.healthFactor !== null && projection.healthFactor < 1;
    const exceeds = amountNum > max + 1e-9;
    const invalid = amountNum <= 0 || exceeds || willLiquidate;
    const currentHf = position?.healthFactor ?? null;

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

    // fetch wallet balance for supply/repay max context (not returned by the position feed)
    useEffect(() => {
        if (!address || !window.ethereum || (kind !== 'supply' && kind !== 'repay')) return;
        let active = true;
        const provider = new BrowserProvider(window.ethereum);
        const tokenAddress = isSupplySide ? market.supplyAddress : market.borrowAddress;
        const balance =
            tokenAddress.toLowerCase() === FLUID_NATIVE_ETH.toLowerCase()
                ? provider.getBalance(address)
                : new Contract(tokenAddress, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(address);
        balance.then((raw: bigint) => {
            if (active) setWalletBalance(Number(formatUnits(raw, decimals)));
        });
        return () => {
            active = false;
        };
    }, [address, kind, isSupplySide, market.supplyAddress, market.borrowAddress, decimals]);

    const submit = async () => {
        if (!address) return;
        setSubmitting(true);
        try {
            const signer = await getSigner();
            const exec = platform === 'morpho' ? executeMorphoAction : executeFluidAction;
            const tx = await exec({ signer, account: address, market, position, kind, amount, isMax, onStep: setStep });
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
                    <TokenIcon symbol={symbol} address={isSupplySide ? market.supplyAddress : market.borrowAddress} size={40} />
                    <div>
                        <div className={styles.symbol}>{symbol}</div>
                        <div className={styles.price}>
                            {market.supplySymbol} / {market.borrowSymbol}
                        </div>
                    </div>
                </div>
                <button className={styles.close} onClick={onClose} aria-label="Close">
                    ✕
                </button>
            </div>

            <div className={styles.tabsWrap}>
                <AnimatedTabs
                    tabs={(['supply', 'withdraw', 'borrow', 'repay'] as ActionKind[]).map((k) => ({ value: k, label: labelFor[k] }))}
                    active={kind}
                    onChange={onPickKind}
                    layoutId="pairDrawerTab"
                    fullWidth
                />
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
                    <span>{amountNum > 0 ? fmtUsd(amountNum * price) : '$0.00'}</span>
                    <span>
                        {context[kind].label}: {fmtToken(context[kind].value)} {symbol}
                    </span>
                </div>
            </div>

            <input
                className={styles.slider}
                style={{ '--fill': `${sliderPct}%` } as React.CSSProperties}
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

            <div className={styles.summary}>
                <Row label="Health factor" value={<HealthBadge hf={currentHf} projected={amountNum > 0 ? projection.healthFactor : undefined} />} />
                <Row label="Supplied" value={fmtUsd(amountNum > 0 ? projection.suppliedUsd : position?.suppliedUsd ?? 0)} />
                <Row label="Debt" value={fmtUsd(amountNum > 0 ? projection.debtUsd : position?.debtUsd ?? 0)} />
            </div>

            {willLiquidate && <div className={styles.error}>This would put your position below the liquidation threshold.</div>}

            <Button block size="lg" variant="primary" disabled={invalid} loading={submitting} onClick={submit}>
                {submitting ? stepLabel(step, symbol, labelFor[kind]) : exceeds ? 'Exceeds maximum' : labelFor[kind]}
            </Button>
        </div>
    );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className={styles.row}>
        <span>{label}</span>
        <span className={styles.rowValue}>{value}</span>
    </div>
);
