export const CHART_COLORS = ['#0071e3', '#34c759', '#5e5ce6', '#ff9500', '#30b0c7', '#ff2d55', '#af52de', '#8e8e93'];

export const AXIS_COLOR = '#86868b';
export const GRID_COLOR = '#ececef';

export const tooltipStyle = {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid #e3e3e6',
    borderRadius: 12,
    boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
    fontSize: 12,
    color: '#1d1d1f',
    padding: '6px 10px',
    whiteSpace: 'nowrap' as const
};

export const tooltipLabelStyle = { color: '#86868b', fontWeight: 500, marginBottom: 2 };
export const tooltipItemStyle = { color: '#1d1d1f' };
export const tooltipWrapperStyle = { zIndex: 30, pointerEvents: 'none' as const };
