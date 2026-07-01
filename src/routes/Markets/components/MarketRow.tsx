import { useCallback } from 'react';
import { Button } from '@/components/Button/Button';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { fmtPct, fmtToken, fmtUsd } from '@/lib/format';
import type { ActionKind, ReserveWithUser } from '@shared/types';
import { UtilizationBar } from './UtilizationBar';
import styles from './MarketRow.module.scss';

type Props = {
    reserve: ReserveWithUser;
    variant: 'collateral' | 'borrow';
    connected: boolean;
    onAct: (id: number, kind: ActionKind) => void;
    actions?: boolean;
};

const statusTag = (r: ReserveWithUser): string | null => {
    if (r.paused) return 'Paused';
    if (r.frozen) return 'Frozen';
    return null;
};

export const MarketRow = ({ reserve, variant, connected, onAct, actions = true }: Props) => {
    const disabled = reserve.paused || reserve.frozen;
    const tag = statusTag(reserve);
    const liquidity = Math.max(0, reserve.totalSuppliedUsd - reserve.totalDebtUsd);

    const onSupply = useCallback(() => onAct(reserve.id, 'supply'), [onAct, reserve.id]);
    const onWithdraw = useCallback(() => onAct(reserve.id, 'withdraw'), [onAct, reserve.id]);
    const onBorrow = useCallback(() => onAct(reserve.id, 'borrow'), [onAct, reserve.id]);
    const onRepay = useCallback(() => onAct(reserve.id, 'repay'), [onAct, reserve.id]);

    return (
        <div className={styles.row}>
            <div className={styles.asset}>
                <TokenIcon symbol={reserve.symbol} address={reserve.underlying} size={36} />
                <div className={styles.assetText}>
                    <span className={styles.symbol}>
                        {reserve.symbol}
                        {tag && <span className={styles.tag}>{tag}</span>}
                    </span>
                    <span className={styles.price}>{fmtUsd(reserve.priceUsd)}</span>
                </div>
            </div>

            {variant === 'collateral' ? (
                <>
                    <div className={styles.cell} data-label="Max LTV">
                        <span className={styles.value}>{fmtPct(reserve.collateralFactor)}</span>
                    </div>
                    <div className={styles.cell} data-label="Total supplied">
                        <span className={styles.value}>{fmtUsd(reserve.totalSuppliedUsd, true)}</span>
                        <span className={styles.sub}>{fmtToken(reserve.totalSupplied)}</span>
                    </div>
                    {connected && (
                        <>
                            <div className={styles.cell} data-label="Your wallet">
                                <span className={styles.value}>{fmtToken(reserve.walletBalance)}</span>
                            </div>
                            <div className={styles.cell} data-label="Your supplied">
                                <span className={styles.value}>
                                    {reserve.supplied > 0 ? fmtToken(reserve.supplied) : '—'}
                                </span>
                            </div>
                        </>
                    )}
                    {actions && (
                        <div className={styles.actions}>
                            <Button size="sm" variant="primary" disabled={disabled} onClick={onSupply}>
                                Supply
                            </Button>
                            {reserve.supplied > 0 && (
                                <Button size="sm" variant="secondary" disabled={disabled} onClick={onWithdraw}>
                                    Withdraw
                                </Button>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className={styles.cell} data-label="Borrow APR">
                        <span className={styles.value}>{fmtPct(reserve.borrowApr)}</span>
                    </div>
                    <div className={styles.cell} data-label="Supply APR">
                        <span className={[styles.value, styles.supplyApr].join(' ')}>
                            {fmtPct(reserve.supplyApr)}
                        </span>
                    </div>
                    <div className={styles.cell} data-label="Utilization">
                        <UtilizationBar value={reserve.utilization} />
                    </div>
                    <div className={styles.cell} data-label="Available">
                        <span className={styles.value}>{fmtUsd(liquidity, true)}</span>
                    </div>
                    {connected && (
                        <div className={styles.cell} data-label="Your debt">
                            <span className={styles.value}>
                                {reserve.debt > 0 ? fmtToken(reserve.debt) : '—'}
                            </span>
                        </div>
                    )}
                    {actions && (
                        <div className={styles.actions}>
                            <Button size="sm" variant="primary" disabled={disabled} onClick={onBorrow}>
                                Borrow
                            </Button>
                            {reserve.debt > 0 ? (
                                <Button size="sm" variant="secondary" disabled={disabled} onClick={onRepay}>
                                    Repay
                                </Button>
                            ) : (
                                <Button size="sm" variant="secondary" disabled={disabled} onClick={onSupply}>
                                    Supply
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
