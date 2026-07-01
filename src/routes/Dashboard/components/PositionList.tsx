import { motion } from 'motion/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button/Button';
import { HealthBadge } from '@/components/HealthBadge/HealthBadge';
import { PlatformIcon } from '@/components/PlatformIcon/PlatformIcon';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { useApp, type PairPlatform, type PooledPlatform } from '@/lib/app';
import { setAaveV3Collateral, setCollateral } from '@/lib/contracts';
import { parseTxError } from '@/lib/errors';
import { fmtPct, fmtToken, fmtUsd } from '@/lib/format';
import { PLATFORM_LABEL, type PlatformKey } from '@/lib/platform';
import { useToast } from '@/lib/toast';
import { useWallet } from '@/lib/wallet';
import type { ActionKind, PairMarket, PairPosition, ReserveWithUser } from '@shared/types';
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

export type SupplyItem =
    | { kind: 'pooled'; platform: PooledPlatform; reserve: ReserveWithUser }
    | { kind: 'pair'; platform: PairPlatform; market: PairMarket; position: PairPosition };

export type BorrowItem =
    | { kind: 'pooled'; platform: PooledPlatform; reserve: ReserveWithUser }
    | { kind: 'pair'; platform: PairPlatform; market: PairMarket; position: PairPosition };

type Entry = {
    key: string;
    platform: PlatformKey;
    symbol: string;
    address: string;
    amount: number;
    amountUsd: number;
    apr: number;
    healthFactor: number | null | undefined; // undefined = not applicable (pooled account)
    isCollateral: boolean | undefined; // undefined = not applicable (pair positions)
    canBeCollateral: boolean;
    reserveId: number | undefined;
    marketId: string | undefined;
};

const supplyEntry = (item: SupplyItem): Entry =>
    item.kind === 'pooled'
        ? {
              key: `${item.platform}-${item.reserve.id}`,
              platform: item.platform,
              symbol: item.reserve.symbol,
              address: item.reserve.underlying,
              amount: item.reserve.supplied,
              amountUsd: item.reserve.suppliedUsd,
              apr: item.reserve.supplyApr,
              healthFactor: undefined,
              isCollateral: item.reserve.isCollateral,
              canBeCollateral: item.reserve.canBeCollateral,
              reserveId: item.reserve.id,
              marketId: undefined
          }
        : {
              key: `${item.platform}-${item.position.id}`,
              platform: item.platform,
              symbol: item.market.supplySymbol,
              address: item.market.supplyAddress,
              amount: item.position.supplied,
              amountUsd: item.position.suppliedUsd,
              apr: item.market.supplyApr,
              healthFactor: undefined,
              isCollateral: undefined,
              canBeCollateral: false,
              reserveId: undefined,
              marketId: item.position.marketId
          };

const borrowEntry = (item: BorrowItem): Entry =>
    item.kind === 'pooled'
        ? {
              key: `${item.platform}-${item.reserve.id}`,
              platform: item.platform,
              symbol: item.reserve.symbol,
              address: item.reserve.underlying,
              amount: item.reserve.debt,
              amountUsd: item.reserve.debtUsd,
              apr: item.reserve.borrowApr,
              healthFactor: undefined,
              isCollateral: undefined,
              canBeCollateral: false,
              reserveId: item.reserve.id,
              marketId: undefined
          }
        : {
              key: `${item.platform}-${item.position.id}`,
              platform: item.platform,
              symbol: item.market.borrowSymbol,
              address: item.market.borrowAddress,
              amount: item.position.debt,
              amountUsd: item.position.debtUsd,
              apr: item.market.borrowApr,
              healthFactor: item.position.healthFactor,
              isCollateral: undefined,
              canBeCollateral: false,
              reserveId: undefined,
              marketId: item.position.marketId
          };

type Group = {
    symbol: string;
    address: string;
    totalUsd: number;
    entries: Entry[];
};

const groupBySymbol = (entries: Entry[]): Group[] => {
    const map = new Map<string, Group>();
    for (const e of entries) {
        const g = map.get(e.symbol);
        if (g) {
            g.entries.push(e);
            g.totalUsd += e.amountUsd;
        } else {
            map.set(e.symbol, { symbol: e.symbol, address: e.address, totalUsd: e.amountUsd, entries: [e] });
        }
    }
    return [...map.values()].sort((a, b) => b.totalUsd - a.totalUsd);
};

type PickerProps = {
    entries: Entry[];
    anchor: { top: number; right: number };
    onPick: (entry: Entry) => void;
    onClose: () => void;
};

const ProviderPicker = ({ entries, anchor, onPick, onClose }: PickerProps) =>
    createPortal(
        <>
            <div className={styles.pickerBackdrop} onClick={onClose} />
            <div className={styles.picker} style={{ top: anchor.top, right: anchor.right }}>
                {entries.map((e) => (
                    <button key={e.key} type="button" className={styles.pickerRow} onClick={() => onPick(e)}>
                        <PlatformIcon platform={e.platform} size={22} />
                        <span className={styles.pickerPlatform}>{PLATFORM_LABEL[e.platform]}</span>
                        <span className={styles.pickerAmount}>
                            {fmtToken(e.amount)} {e.symbol}
                        </span>
                    </button>
                ))}
            </div>
        </>,
        document.body
    );

type GroupRowProps = {
    group: Group;
    account: string;
    primaryKind: ActionKind;
    secondaryKind: ActionKind;
    aprAccent: 'aprSupply' | 'aprBorrow';
};

const GroupRow = ({ group, account, primaryKind, secondaryKind, aprAccent }: GroupRowProps) => {
    const { getSigner } = useWallet();
    const { toast } = useToast();
    const { openAction, openPairAction, portfolio, otherPlatforms } = useApp();
    const [picking, setPicking] = useState<ActionKind | null>(null);
    const [pickerAnchor, setPickerAnchor] = useState({ top: 0, right: 0 });
    const [togglePending, setTogglePending] = useState(false);
    const actionsRef = useRef<HTMLDivElement>(null);

    const single = group.entries.length === 1 ? group.entries[0] : undefined;

    const openEntry = useCallback(
        (entry: Entry, kind: ActionKind) => {
            if (entry.reserveId !== undefined) openAction(entry.platform as PooledPlatform, entry.reserveId, kind);
            else if (entry.marketId !== undefined) openPairAction(entry.platform as PairPlatform, entry.marketId, kind);
        },
        [openAction, openPairAction]
    );

    const onAct = useCallback(
        (kind: ActionKind) => {
            if (single) {
                openEntry(single, kind);
                return;
            }
            const rect = actionsRef.current?.getBoundingClientRect();
            if (rect) setPickerAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
            setPicking(kind);
        },
        [single, openEntry]
    );

    const onPick = useCallback(
        (entry: Entry) => {
            if (picking) openEntry(entry, picking);
            setPicking(null);
        },
        [picking, openEntry]
    );

    const onToggleCollateral = useCallback(async () => {
        if (!single || single.isCollateral === undefined || single.reserveId === undefined) return;
        const next = !single.isCollateral;
        setTogglePending(true);
        try {
            const signer = await getSigner();
            if (single.platform === 'aave-v4') await setCollateral(signer, account, single.reserveId, next);
            else await setAaveV3Collateral(signer, single.address, next);
            toast(next ? `${single.symbol} enabled as collateral` : `${single.symbol} disabled as collateral`, 'success');
            portfolio.refresh();
            otherPlatforms.refresh();
        } catch (e) {
            toast(parseTxError(e), 'error');
        } finally {
            setTogglePending(false);
        }
    }, [single, account, getSigner, portfolio, otherPlatforms, toast]);

    const primaryLabel = primaryKind === 'supply' ? 'Supply' : 'Borrow';
    const secondaryLabel = secondaryKind === 'withdraw' ? 'Withdraw' : 'Repay';
    const worstHf = group.entries
        .map((e) => e.healthFactor)
        .filter((hf): hf is number => typeof hf === 'number')
        .reduce((min, hf) => (min === null ? hf : Math.min(min, hf)), null as number | null);

    return (
        <div className={styles.row}>
            <div className={styles.asset}>
                <TokenIcon symbol={group.symbol} address={group.address} size={32} />
                <span className={styles.sym}>{group.symbol}</span>
                {single && (
                    <span className={styles.platformTag}>
                        <PlatformIcon platform={single.platform} size={14} />
                        {PLATFORM_LABEL[single.platform]}
                    </span>
                )}
            </div>
            {single ? (
                <>
                    <div className={styles.amount}>
                        <span className={styles.amountMain}>{fmtToken(single.amount)}</span>
                        <span className={styles.amountSub}>{fmtUsd(single.amountUsd)}</span>
                    </div>
                    <span className={[styles.apr, styles[aprAccent]].join(' ')}>{fmtPct(single.apr)}</span>
                </>
            ) : (
                <div className={styles.breakdown}>
                    {group.entries.map((e) => (
                        <div key={e.key} className={styles.breakdownRow}>
                            <PlatformIcon platform={e.platform} size={16} />
                            <span className={styles.breakdownPlatform}>{PLATFORM_LABEL[e.platform]}</span>
                            <span className={styles.amountMain}>{fmtToken(e.amount)}</span>
                            <span className={[styles.apr, styles[aprAccent]].join(' ')}>{fmtPct(e.apr)}</span>
                        </div>
                    ))}
                    <span className={styles.amountSub}>{fmtUsd(group.totalUsd)}</span>
                </div>
            )}
            {primaryKind === 'borrow' && (
                <div className={styles.health}>
                    <HealthBadge hf={worstHf} size="sm" />
                </div>
            )}
            {primaryKind === 'supply' && (
                <div className={styles.collateral}>
                    {single && single.canBeCollateral && single.isCollateral !== undefined ? (
                        <CollateralSwitch on={single.isCollateral} pending={togglePending} onToggle={onToggleCollateral} />
                    ) : (
                        <span className={styles.collateralLabel}>—</span>
                    )}
                </div>
            )}
            <div className={styles.actions} ref={actionsRef}>
                <Button size="sm" variant="primary" onClick={() => onAct(primaryKind)}>
                    {primaryLabel}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onAct(secondaryKind)}>
                    {secondaryLabel}
                </Button>
                {picking && (
                    <ProviderPicker entries={group.entries} anchor={pickerAnchor} onPick={onPick} onClose={() => setPicking(null)} />
                )}
            </div>
        </div>
    );
};

type SupplyListProps = {
    items: SupplyItem[];
    account: string;
};

export const SupplyList = ({ items, account }: SupplyListProps) => {
    const groups = useMemo(() => groupBySymbol(items.map(supplyEntry)), [items]);
    return (
        <>
            {groups.map((g) => (
                <GroupRow key={g.symbol} group={g} account={account} primaryKind="supply" secondaryKind="withdraw" aprAccent="aprSupply" />
            ))}
        </>
    );
};

type BorrowListProps = {
    items: BorrowItem[];
    account: string;
};

export const BorrowList = ({ items, account }: BorrowListProps) => {
    const groups = useMemo(() => groupBySymbol(items.map(borrowEntry)), [items]);
    return (
        <>
            {groups.map((g) => (
                <GroupRow key={g.symbol} group={g} account={account} primaryKind="borrow" secondaryKind="repay" aprAccent="aprBorrow" />
            ))}
        </>
    );
};
