import { useTheme } from '@/lib/theme';

export const CHART_COLORS = ['#0071e3', '#34c759', '#5e5ce6', '#ff9500', '#30b0c7', '#ff2d55', '#af52de', '#8e8e93'];

const LIGHT = {
    axis: '#86868b',
    grid: '#ececef',
    cursor: '#d2d2d7',
    accent: '#0071e3',
    hold: '#1d1d1f',
    dot: '#ffffff',
    good: '#00a152',
    warn: '#bd6b00',
    bad: '#e5342a',
    tooltip: {
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #e3e3e6',
        borderRadius: 12,
        boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
        fontSize: 12,
        color: '#1d1d1f',
        padding: '6px 10px',
        whiteSpace: 'nowrap' as const
    },
    tooltipLabel: { color: '#86868b', fontWeight: 500, marginBottom: 2 },
    tooltipItem: { color: '#1d1d1f' }
};

const DARK: typeof LIGHT = {
    axis: '#86868b',
    grid: '#2c2c2e',
    cursor: '#424245',
    accent: '#2997ff',
    hold: '#f5f5f7',
    dot: '#1d1d1f',
    good: '#30d158',
    warn: '#ff9f0a',
    bad: '#ff453a',
    tooltip: {
        background: 'rgba(29,29,31,0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #424245',
        borderRadius: 12,
        boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
        fontSize: 12,
        color: '#f5f5f7',
        padding: '6px 10px',
        whiteSpace: 'nowrap' as const
    },
    tooltipLabel: { color: '#86868b', fontWeight: 500, marginBottom: 2 },
    tooltipItem: { color: '#f5f5f7' }
};

export const tooltipWrapperStyle = { zIndex: 30, pointerEvents: 'none' as const };

export const useChartTheme = () => (useTheme() === 'dark' ? DARK : LIGHT);
