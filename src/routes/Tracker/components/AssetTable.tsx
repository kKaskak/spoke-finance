import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { fmtPct, fmtPrice, fmtSignedUsd, fmtToken, fmtUsd } from '@/lib/format';
import type { TrackedAsset } from '@shared/types';
import styles from './AssetTable.module.scss';

const COLS = 'minmax(200px, 1.8fr) repeat(7, 1fr)';
const HEADERS = ['Asset', 'Avg buy', 'Avg sell', 'Price', 'Value', 'Realized', 'Unrealized', 'P&L'];

const tone = (n: number) => (n > 0 ? styles.pos : n < 0 ? styles.neg : styles.muted);

type RowProps = { asset: TrackedAsset; active: boolean; onSelect: (symbol: string | null) => void };

const AssetRow = ({ asset, active, onSelect }: RowProps) => {
    const onClick = () => onSelect(active ? null : asset.symbol);
    const pnl = asset.realizedUsd + (asset.unrealizedUsd ?? 0);
    const pnlPct = asset.boughtUsd > 0 ? pnl / asset.boughtUsd : null;
    return (
        <button type="button" className={[styles.row, active ? styles.rowActive : ''].join(' ')} onClick={onClick}>
            <div className={styles.asset}>
                <TokenIcon symbol={asset.symbol} address={asset.address} size={36} />
                <div className={styles.assetText}>
                    <span className={styles.symbol}>{asset.symbol}</span>
                    <span className={styles.qty}>
                        {asset.qty > 0 ? `${fmtToken(asset.qty, asset.qty >= 1000 ? 0 : 4)} held · cost ${fmtPrice(asset.avgCost)}` : 'Sold out'}
                    </span>
                </div>
            </div>
            <div className={styles.cell} data-label="Avg buy">
                <span className={styles.value}>{asset.boughtQty > 0 ? fmtPrice(asset.avgBuy) : '—'}</span>
                <span className={styles.sub}>{asset.boughtQty > 0 ? fmtUsd(asset.boughtUsd, true) : ''}</span>
            </div>
            <div className={styles.cell} data-label="Avg sell">
                <span className={styles.value}>{asset.soldQty > 0 ? fmtPrice(asset.avgSell) : '—'}</span>
                <span className={styles.sub}>{asset.soldQty > 0 ? fmtUsd(asset.soldUsd, true) : ''}</span>
            </div>
            <div className={styles.cell} data-label="Price">
                <span className={styles.value}>{asset.priceUsd === null ? '—' : fmtPrice(asset.priceUsd)}</span>
            </div>
            <div className={styles.cell} data-label="Value">
                <span className={styles.value}>{asset.valueUsd === null || asset.qty === 0 ? '—' : fmtUsd(asset.valueUsd)}</span>
            </div>
            <div className={styles.cell} data-label="Realized">
                <span className={[styles.value, tone(asset.realizedUsd)].join(' ')}>{fmtSignedUsd(asset.realizedUsd)}</span>
            </div>
            <div className={styles.cell} data-label="Unrealized">
                <span className={[styles.value, asset.unrealizedUsd === null ? styles.muted : tone(asset.unrealizedUsd)].join(' ')}>
                    {asset.unrealizedUsd === null || asset.qty === 0 ? '—' : fmtSignedUsd(asset.unrealizedUsd)}
                </span>
            </div>
            <div className={styles.cell} data-label="P&L">
                <span className={[styles.value, tone(pnl)].join(' ')}>{pnlPct === null ? '—' : `${pnl < 0 ? '−' : '+'}${fmtPct(Math.abs(pnlPct), 1)}`}</span>
            </div>
        </button>
    );
};

type Props = { assets: TrackedAsset[]; selected: string | null; onSelect: (symbol: string | null) => void };

export const AssetTable = ({ assets, selected, onSelect }: Props) => (
    <div className={styles.table} style={{ ['--cols' as string]: COLS }}>
        <div className={styles.header}>
            {HEADERS.map((h, i) => (
                <span key={h} className={i === 0 ? undefined : styles.headEnd}>
                    {h}
                </span>
            ))}
        </div>
        {assets.map((a) => (
            <AssetRow key={a.symbol} asset={a} active={selected === a.symbol} onSelect={onSelect} />
        ))}
    </div>
);
