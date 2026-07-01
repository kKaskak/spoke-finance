import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_COLOR, GRID_COLOR, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from '@/lib/chart';
import { fmtPct, fmtUsd } from '@/lib/format';
import { holdNetWorth, loopModel, loopNetWorth } from '@/lib/projection';
import type { AccountSummary, ReserveWithUser } from '@shared/types';
import styles from './LoopSimulator.module.scss';

const STEPS = 48;
const HOLD = '#1d1d1f';
const LOOP = '#0071e3';

type Props = {
    account: AccountSummary;
    reserves: ReserveWithUser[];
};

const mult = (n: number) => `${n.toFixed(1)}×`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const LoopSimulator = ({ account, reserves }: Props) => {
    const stableApr = useMemo(() => {
        const ghoLike = reserves.find((r) => r.symbol === 'GHO') || reserves.find((r) => ['USDC', 'USDT', 'DAI'].includes(r.symbol));
        return ghoLike?.borrowApr ?? 0.035;
    }, [reserves]);

    const cf = account.avgCollateralFactor || 0.8;
    const [monthly, setMonthly] = useState(1000);
    const [months, setMonths] = useState(24);
    const [targetX, setTargetX] = useState(2);
    const [targetHf, setTargetHf] = useState(() => clamp(account.healthFactor ?? 2, 1.2, 3));

    const equity = Math.max(0, account.netWorthUsd) + monthly * months;
    const model = useMemo(() => loopModel(equity, cf, targetHf, stableApr, months / 12), [equity, cf, targetHf, stableApr, months]);

    const lo = 1 / targetX;
    const liqM = 1 / targetHf;
    const data = useMemo(
        () =>
            Array.from({ length: STEPS + 1 }, (_, i) => {
                const m = lo + ((targetX - lo) * i) / STEPS;
                return { m, hold: holdNetWorth(equity, m), loop: Math.max(0, loopNetWorth(equity, model, m)) };
            }),
        [equity, model, targetX, lo]
    );

    const holdEnd = holdNetWorth(equity, targetX);
    const loopEnd = loopNetWorth(equity, model, targetX);
    const edge = loopEnd - holdEnd;

    return (
        <div className={styles.wrap}>
            <div className={styles.controls}>
                <Slider
                    label="Monthly contribution"
                    value={fmtUsd(monthly)}
                    min={0}
                    max={5000}
                    step={100}
                    pos={monthly}
                    onChange={setMonthly}
                />
                <Slider
                    label="Horizon"
                    value={`${months} mo`}
                    min={1}
                    max={60}
                    step={1}
                    pos={months}
                    onChange={setMonths}
                />
                <Slider
                    label="Target price"
                    value={mult(targetX)}
                    min={1}
                    max={5}
                    step={0.1}
                    pos={targetX}
                    onChange={setTargetX}
                />
                <Slider
                    label="Held health factor"
                    value={targetHf.toFixed(2)}
                    min={1.2}
                    max={3}
                    step={0.05}
                    pos={targetHf}
                    onChange={setTargetHf}
                />
            </div>

            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <span className={styles.swatch} style={{ background: HOLD }} />
                    Buy &amp; hold
                </span>
                <span className={styles.legendItem}>
                    <span className={styles.swatch} style={{ background: LOOP }} />
                    Loop · keep HF {targetHf.toFixed(2)} ({model.leverage.toFixed(2)}×)
                </span>
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                    <defs>
                        <linearGradient id="loopFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={LOOP} stopOpacity={0.18} />
                            <stop offset="100%" stopColor={LOOP} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="holdFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={HOLD} stopOpacity={0.08} />
                            <stop offset="100%" stopColor={HOLD} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                    <XAxis
                        dataKey="m"
                        type="number"
                        domain={[lo, targetX]}
                        tickFormatter={mult}
                        tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: GRID_COLOR }}
                    />
                    <YAxis
                        tickFormatter={(v) => fmtUsd(Number(v), true)}
                        tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                    />
                    <ReferenceLine
                        x={1}
                        stroke={AXIS_COLOR}
                        strokeDasharray="4 4"
                        strokeOpacity={0.6}
                        label={{ value: 'Now', position: 'insideTopLeft', fill: AXIS_COLOR, fontSize: 11 }}
                    />
                    {liqM > lo && (
                        <ReferenceLine
                            x={liqM}
                            stroke="#e5342a"
                            strokeDasharray="4 4"
                            strokeOpacity={0.7}
                            label={{ value: 'Liquidation', position: 'insideTopRight', fill: '#e5342a', fontSize: 11 }}
                        />
                    )}
                    <Area
                        name="Buy & hold"
                        type="monotone"
                        dataKey="hold"
                        stroke={HOLD}
                        strokeWidth={2}
                        fill="url(#holdFill)"
                        isAnimationActive={false}
                    />
                    <Area
                        name="Loop"
                        type="monotone"
                        dataKey="loop"
                        stroke={LOOP}
                        strokeWidth={2.5}
                        fill="url(#loopFill)"
                        isAnimationActive={false}
                    />
                    <ReferenceDot x={targetX} y={loopEnd} r={5} fill="#ffffff" stroke={LOOP} strokeWidth={2.5} />
                    <Tooltip
                        cursor={{ stroke: '#d2d2d7' }}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        itemStyle={tooltipItemStyle}
                        itemSorter={(item) => -Number(item.value)}
                        labelFormatter={(v) => `${mult(Number(v))} price`}
                        formatter={(value, name) => [fmtUsd(Number(value), true), name]}
                    />
                </AreaChart>
            </ResponsiveContainer>

            <div className={styles.stats}>
                <Stat label={`Loop net worth at ${mult(targetX)}`} value={fmtUsd(loopEnd, true)} accent />
                <Stat label="Extra vs holding" value={`${edge >= 0 ? '+' : '−'}${fmtUsd(Math.abs(edge), true)}`} />
                <Stat label="GHO debt" value={fmtUsd(model.debtUsd, true)} />
                <Stat label={`Health factor at ${mult(targetX)}`} value={(targetHf * targetX).toFixed(2)} />
            </div>
            <p className={styles.note}>
                Exposure {model.leverage.toFixed(2)}× on {fmtUsd(equity, true)} equity ({fmtUsd(account.netWorthUsd, true)} now +{' '}
                {fmtUsd(monthly)}/mo for {months} mo). GHO at {fmtPct(stableApr)} APR; debt held flat so health factor moves
                with price — looping liquidates near {mult(liqM)} on the way down. No auto-reborrow on gains.
            </p>
        </div>
    );
};

type SliderProps = {
    label: string;
    value: string;
    min: number;
    max: number;
    step: number;
    pos: number;
    onChange: (n: number) => void;
};

const Slider = ({ label, value, min, max, step, pos, onChange }: SliderProps) => {
    const fill = `${((pos - min) / (max - min)) * 100}%`;
    return (
        <div className={styles.control}>
            <div className={styles.controlHead}>
                <span className={styles.controlLabel}>{label}</span>
                <span className={styles.controlValue}>{value}</span>
            </div>
            <input
                className={styles.slider}
                style={{ '--fill': fill } as React.CSSProperties}
                type="range"
                min={min}
                max={max}
                step={step}
                value={pos}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </div>
    );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <div className={styles.stat}>
        <span className={styles.statLabel}>{label}</span>
        <span className={[styles.statValue, accent ? styles.statAccent : ''].join(' ')}>{value}</span>
    </div>
);
