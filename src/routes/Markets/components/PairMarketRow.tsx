import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { fmtPct, fmtUsd } from '@/lib/format';
import type { PairMarket } from '@shared/types';
import { UtilizationBar } from './UtilizationBar';
import styles from './MarketRow.module.scss';

type Props = {
    market: PairMarket;
};

export const PairMarketRow = ({ market }: Props) => (
    <div className={styles.row}>
        <div className={styles.asset}>
            <div className={styles.icons}>
                <TokenIcon symbol={market.supplySymbol} address={market.supplyAddress} size={30} />
                <TokenIcon symbol={market.borrowSymbol} address={market.borrowAddress} size={18} />
            </div>
            <div className={styles.assetText}>
                <span className={styles.symbol}>
                    {market.supplySymbol}
                    <span className={styles.pairSep}>/ {market.borrowSymbol}</span>
                </span>
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
    </div>
);
