import { useCallback } from 'react';
import { Button } from '@/components/Button/Button';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { fmtPct, fmtUsd } from '@/lib/format';
import type { ActionKind, PairMarket } from '@shared/types';
import { UtilizationBar } from './UtilizationBar';
import styles from './MarketRow.module.scss';

type Props = {
    market: PairMarket;
    onAct: (marketId: string, kind: ActionKind) => void;
};

export const PairMarketRow = ({ market, onAct }: Props) => {
    const onSupply = useCallback(() => onAct(market.id, 'supply'), [onAct, market.id]);
    const onBorrow = useCallback(() => onAct(market.id, 'borrow'), [onAct, market.id]);

    return (
        <div className={styles.row}>
            <div className={styles.asset}>
                <div className={styles.icons}>
                    <TokenIcon symbol={market.supplySymbol} address={market.supplyAddress} size={30} />
                    <TokenIcon symbol={market.borrowSymbol} address={market.borrowAddress} size={18} />
                </div>
                <div className={styles.assetText}>
                    <span className={styles.symbol}>{market.supplySymbol}</span>
                    <span className={styles.pairSub}>/ {market.borrowSymbol}</span>
                </div>
            </div>
            <div className={styles.cell} data-label="Max LTV">
                <span className={styles.value}>{fmtPct(market.maxLtv)}</span>
            </div>
            <div className={styles.cell} data-label="Total supplied">
                <span className={styles.value}>{fmtUsd(market.totalSuppliedUsd, true)}</span>
            </div>
            <div className={styles.cell} data-label="Total borrowed">
                <span className={styles.value}>{fmtUsd(market.totalDebtUsd, true)}</span>
            </div>
            <div className={styles.cell} data-label="Supply APR">
                <span className={[styles.value, styles.supplyApr].join(' ')}>{fmtPct(market.supplyApr)}</span>
            </div>
            <div className={styles.cell} data-label="Borrow APR">
                <span className={styles.value}>{fmtPct(market.borrowApr)}</span>
            </div>
            <div className={styles.cell} data-label="Utilization">
                <UtilizationBar value={market.utilization} />
            </div>
            <div className={styles.actions}>
                <Button size="sm" variant="primary" onClick={onSupply}>
                    Supply
                </Button>
                <Button size="sm" variant="secondary" onClick={onBorrow}>
                    Borrow
                </Button>
            </div>
        </div>
    );
};
