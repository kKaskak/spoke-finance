import { motion } from 'motion/react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/Button/Button';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { useApp } from '@/lib/app';
import { setCollateral } from '@/lib/contracts';
import { parseTxError } from '@/lib/errors';
import { fmtPct, fmtToken, fmtUsd } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { useWallet } from '@/lib/wallet';
import type { ReserveWithUser } from '@shared/types';
import styles from './PositionList.module.scss';

const KNOB_SPRING = { type: 'spring' as const, stiffness: 520, damping: 34 };

type CollateralSwitchProps = {
    on: boolean;
    pending: boolean;
    onToggle: () => void;
};

const CollateralSwitch = ({ on, pending, onToggle }: CollateralSwitchProps) => (
    <button
        type="button"
        className={[styles.switch, on ? styles.switchOn : ''].join(' ')}
        onClick={onToggle}
        disabled={pending}
        aria-pressed={on}
        title="Use as collateral"
    >
        <motion.span
            className={styles.knob}
            animate={{ x: on ? 16 : 0 }}
            transition={pending ? { duration: 0 } : KNOB_SPRING}
        />
    </button>
);

type SupplyRowProps = {
    reserve: ReserveWithUser;
    account: string;
};

export const SupplyRow = ({ reserve, account }: SupplyRowProps) => {
    const { getSigner } = useWallet();
    const { toast } = useToast();
    const { openAction, portfolio } = useApp();
    const [pending, setPending] = useState(false);

    const onToggle = useCallback(async () => {
        const next = !reserve.isCollateral;
        setPending(true);
        try {
            const signer = await getSigner();
            await setCollateral(signer, account, reserve.id, next);
            toast(next ? `${reserve.symbol} enabled as collateral` : `${reserve.symbol} disabled as collateral`, 'success');
            portfolio.refresh();
        } catch (e) {
            toast(parseTxError(e), 'error');
        } finally {
            setPending(false);
        }
    }, [account, getSigner, portfolio, reserve.id, reserve.isCollateral, reserve.symbol, toast]);

    const onSupply = useCallback(() => openAction(reserve.id, 'supply'), [openAction, reserve.id]);
    const onWithdraw = useCallback(() => openAction(reserve.id, 'withdraw'), [openAction, reserve.id]);

    return (
        <div className={styles.row}>
            <div className={styles.asset}>
                <TokenIcon symbol={reserve.symbol} address={reserve.underlying} size={32} />
                <span className={styles.sym}>{reserve.symbol}</span>
            </div>
            <div className={styles.amount}>
                <span className={styles.amountMain}>{fmtToken(reserve.supplied)}</span>
                <span className={styles.amountSub}>{fmtUsd(reserve.suppliedUsd)}</span>
            </div>
            <span className={[styles.apr, styles.aprSupply].join(' ')}>{fmtPct(reserve.supplyApr)}</span>
            <div className={styles.collateral}>
                {reserve.canBeCollateral ? (
                    <CollateralSwitch on={reserve.isCollateral} pending={pending} onToggle={onToggle} />
                ) : (
                    <span className={styles.collateralLabel}>—</span>
                )}
            </div>
            <div className={styles.actions}>
                <Button size="sm" variant="primary" onClick={onSupply}>
                    Supply
                </Button>
                <Button size="sm" variant="secondary" onClick={onWithdraw}>
                    Withdraw
                </Button>
            </div>
        </div>
    );
};

type BorrowRowProps = {
    reserve: ReserveWithUser;
};

export const BorrowRow = ({ reserve }: BorrowRowProps) => {
    const { openAction } = useApp();
    const onRepay = useCallback(() => openAction(reserve.id, 'repay'), [openAction, reserve.id]);
    const onBorrow = useCallback(() => openAction(reserve.id, 'borrow'), [openAction, reserve.id]);

    return (
        <div className={styles.row}>
            <div className={styles.asset}>
                <TokenIcon symbol={reserve.symbol} address={reserve.underlying} size={32} />
                <span className={styles.sym}>{reserve.symbol}</span>
            </div>
            <div className={styles.amount}>
                <span className={styles.amountMain}>{fmtToken(reserve.debt)}</span>
                <span className={styles.amountSub}>{fmtUsd(reserve.debtUsd)}</span>
            </div>
            <span className={[styles.apr, styles.aprBorrow].join(' ')}>{fmtPct(reserve.borrowApr)}</span>
            <div className={styles.actions}>
                <Button size="sm" variant="primary" onClick={onBorrow}>
                    Borrow
                </Button>
                <Button size="sm" variant="secondary" onClick={onRepay}>
                    Repay
                </Button>
            </div>
        </div>
    );
};
