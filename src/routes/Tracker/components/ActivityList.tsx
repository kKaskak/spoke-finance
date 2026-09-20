import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/Button/Button';
import { fmtPrice, fmtToken, fmtUsd } from '@/lib/format';
import type { Chain, TradeEvent, TradeLeg } from '@shared/types';
import styles from './ActivityList.module.scss';

const PAGE = 40;
const KIND_LABEL = { swap: 'Swap', receive: 'Received', send: 'Sent', bridge: 'Bridged' } as const;
const CHAIN: Record<Chain, { label: string; explorer: string }> = {
    ethereum: { label: 'Ethereum', explorer: 'https://etherscan.io/tx/' },
    base: { label: 'Base', explorer: 'https://basescan.org/tx/' }
};

const fmtAmount = (n: number) => (n < 0.0001 ? n.toLocaleString('en-US', { maximumSignificantDigits: 3 }) : fmtToken(n, 5));

const fmtDate = (ts: number) =>
    new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const Leg = ({ leg }: { leg: TradeLeg }) => {
    const out = leg.amount < 0;
    const unit = leg.usd === null ? null : Math.abs(leg.usd / leg.amount);
    return (
        <span className={styles.leg}>
            <span className={[styles.legAmount, out ? styles.legOut : styles.legIn].join(' ')}>
                {out ? '−' : '+'}
                {fmtAmount(Math.abs(leg.amount))} {leg.symbol}
            </span>
            {unit !== null && <span className={styles.legUnit}>@ {fmtPrice(unit)}</span>}
        </span>
    );
};

const Row = ({ event }: { event: TradeEvent }) => (
    <div className={styles.row}>
        <span className={styles.date}>
            {fmtDate(event.ts)}
            <span className={styles.chain}>{CHAIN[event.chain].label}</span>
        </span>
        <span className={[styles.kind, styles[event.kind]].join(' ')}>{KIND_LABEL[event.kind]}</span>
        <div className={styles.legs}>
            {event.legs.map((l, i) => (
                <Leg key={`${l.symbol}-${i}`} leg={l} />
            ))}
        </div>
        <span className={styles.value}>{event.valueUsd === null ? '—' : fmtUsd(event.valueUsd)}</span>
        <a
            className={styles.link}
            href={`${CHAIN[event.chain].explorer}${event.hash}`}
            target="_blank"
            rel="noreferrer"
            aria-label="View on explorer"
        >
            <ArrowUpRight size={16} />
        </a>
    </div>
);

export const ActivityList = ({ events }: { events: TradeEvent[] }) => {
    const [limit, setLimit] = useState(PAGE);
    const onMore = () => setLimit((n) => n + PAGE);
    if (events.length === 0) return <p className={styles.empty}>No activity.</p>;
    return (
        <div className={styles.list}>
            {events.slice(0, limit).map((e) => (
                <Row key={`${e.chain}:${e.hash}`} event={e} />
            ))}
            {events.length > limit && (
                <div className={styles.more}>
                    <Button variant="secondary" size="sm" onClick={onMore}>
                        Show {Math.min(PAGE, events.length - limit)} more of {events.length - limit}
                    </Button>
                </div>
            )}
        </div>
    );
};
