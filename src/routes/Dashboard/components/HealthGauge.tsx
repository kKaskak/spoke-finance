import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { GRID_COLOR } from '@/lib/chart';
import { fmtHealth, healthTone } from '@/lib/format';
import styles from './HealthGauge.module.scss';

type Props = {
    hf: number | null;
};

const SCALE = 3;
const TONE_COLOR: Record<'good' | 'warn' | 'bad', string> = {
    good: '#00a152',
    warn: '#bd6b00',
    bad: '#e5342a'
};

export const HealthGauge = ({ hf }: Props) => {
    const tone = healthTone(hf);
    const color = TONE_COLOR[tone];
    const filled = hf === null ? SCALE : Math.min(Math.max(hf, 0), SCALE);
    const data = [{ name: 'hf', value: filled, fill: color }];

    return (
        <div className={styles.wrap}>
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    data={data}
                    startAngle={180}
                    endAngle={0}
                    innerRadius="80%"
                    outerRadius="100%"
                    barSize={16}
                    cy="78%"
                >
                    <PolarAngleAxis type="number" domain={[0, SCALE]} angleAxisId={0} tick={false} />
                    <RadialBar
                        dataKey="value"
                        angleAxisId={0}
                        background={{ fill: GRID_COLOR }}
                        cornerRadius={10}
                        isAnimationActive={false}
                    />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className={styles.center}>
                <span className={[styles.value, styles[tone]].join(' ')}>{fmtHealth(hf)}</span>
                <span className={styles.label}>Health Factor</span>
            </div>
        </div>
    );
};
