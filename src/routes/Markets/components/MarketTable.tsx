import type { ActionKind, ReserveWithUser } from '@shared/types';
import { MarketRow } from './MarketRow';
import styles from '../Markets.module.scss';

type Props = {
    headers: string[];
    cols: string;
    reserves: ReserveWithUser[];
    variant: 'collateral' | 'borrow';
    connected: boolean;
    onAct: (id: number, kind: ActionKind) => void;
    actions?: boolean;
};

export const MarketTable = ({ headers, cols, reserves, variant, connected, onAct, actions = true }: Props) => (
    <div className={styles.table} style={{ ['--cols' as string]: cols }}>
        <div className={styles.header} style={{ ['--cols' as string]: cols }}>
            {headers.map((h, i) => (
                <span key={h || `spacer-${i}`} className={i === 0 ? undefined : styles.headEnd}>
                    {h}
                </span>
            ))}
        </div>
        {reserves.map((r) => (
            <MarketRow key={r.id} reserve={r} variant={variant} connected={connected} onAct={onAct} actions={actions} />
        ))}
    </div>
);
