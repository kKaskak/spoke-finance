import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from '@/lib/chart';
import { projectAction } from '@/lib/projection';
import type { AccountSummary, ActionKind, ReserveWithUser } from '@shared/types';

const CAP = 6;
const STEPS = 48;

type Props = {
    account: AccountSummary;
    reserve: ReserveWithUser;
    kind: ActionKind;
    max: number;
    amount: number;
};

const clamp = (hf: number | null) => Math.min(hf ?? CAP, CAP);

export const HfChart = ({ account, reserve, kind, max, amount }: Props) => {
    const span = max > 0 ? max : 1;
    const data = Array.from({ length: STEPS + 1 }, (_, i) => {
        const a = (span * i) / STEPS;
        return { amount: a, hf: clamp(projectAction(account, reserve, kind, a).healthFactor) };
    });
    const currentHf = clamp(projectAction(account, reserve, kind, amount).healthFactor);

    return (
        <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 6 }}>
                <defs>
                    <linearGradient id="hfFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0071e3" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="amount" hide type="number" domain={[0, span]} />
                <YAxis hide domain={[0, CAP]} />
                <ReferenceLine y={1} stroke="#e5342a" strokeDasharray="4 4" strokeOpacity={0.6} />
                <ReferenceLine y={1.5} stroke="#bd6b00" strokeDasharray="4 4" strokeOpacity={0.35} />
                <Area
                    type="monotone"
                    dataKey="hf"
                    stroke="#0071e3"
                    strokeWidth={2.5}
                    fill="url(#hfFill)"
                    isAnimationActive={false}
                />
                <ReferenceDot x={amount} y={currentHf} r={5} fill="#ffffff" stroke="#0071e3" strokeWidth={2.5} />
                <Tooltip
                    cursor={{ stroke: '#d2d2d7' }}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    labelFormatter={(v) => `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${reserve.symbol}`}
                    formatter={(value) => {
                        const v = Number(value);
                        return [v >= CAP ? '≥6.00' : v.toFixed(2), 'Health'];
                    }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};
