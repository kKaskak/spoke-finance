import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { TokenIcon } from '@/components/TokenIcon/TokenIcon';
import { CHART_COLORS, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from '@/lib/chart';
import { fmtPct, fmtUsd } from '@/lib/format';
import { PLATFORM_LABEL, type PlatformKey } from '@/lib/platform';
import styles from './AllocationDonut.module.scss';

export type Slice = {
    id: string;
    symbol: string;
    address: string;
    usd: number;
    platform?: PlatformKey;
};

type Props = {
    slices: Slice[];
    emptyLabel: string;
};

export const AllocationDonut = ({ slices, emptyLabel }: Props) => {
    const total = slices.reduce((sum, s) => sum + s.usd, 0);

    if (slices.length === 0 || total <= 0) {
        return <div className={styles.empty}>{emptyLabel}</div>;
    }

    return (
        <div className={styles.wrap}>
            <div className={styles.chart}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices}
                            dataKey="usd"
                            nameKey="symbol"
                            innerRadius="74%"
                            outerRadius="100%"
                            paddingAngle={2}
                            stroke="none"
                            isAnimationActive={false}
                        >
                            {slices.map((s, i) => (
                                <Cell key={s.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={tooltipStyle}
                            labelStyle={tooltipLabelStyle}
                            itemStyle={tooltipItemStyle}
                            formatter={(value, name, entry) => {
                                const platform = (entry?.payload as Slice | undefined)?.platform;
                                const label = platform ? `${name} · ${PLATFORM_LABEL[platform]}` : name;
                                return [fmtUsd(Number(value)), label];
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className={styles.center}>
                    <span className={styles.total}>{fmtUsd(total, true)}</span>
                    <span className={styles.totalLabel}>Total</span>
                </div>
            </div>
            <div className={styles.legend}>
                {slices.map((s, i) => (
                    <div key={s.id} className={styles.row}>
                        <span
                            className={styles.swatch}
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <TokenIcon symbol={s.symbol} address={s.address} size={20} />
                        <span className={styles.sym}>{s.symbol}</span>
                        {s.platform && <span className={styles.platformTag}>{PLATFORM_LABEL[s.platform]}</span>}
                        <span className={styles.usd}>{fmtUsd(s.usd, true)}</span>
                        <span className={styles.pct}>{fmtPct(s.usd / total)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
