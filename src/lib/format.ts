export const fmtUsd = (n: number, compact = false): string => {
    if (!isFinite(n)) return '$0.00';
    if (compact && Math.abs(n) >= 1000) {
        return '$' + n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
    }
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
};

export const fmtToken = (n: number, decimals = 4): string => {
    if (!isFinite(n) || n === 0) return '0';
    if (n > 0 && n < 0.0001) return '<0.0001';
    return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
};

export const fmtPct = (n: number, decimals = 2): string => `${(n * 100).toFixed(decimals)}%`;

export const fmtHealth = (hf: number | null): string => {
    if (hf === null) return '∞';
    if (hf > 99) return '99+';
    return hf.toFixed(2);
};

export const healthTone = (hf: number | null): 'good' | 'warn' | 'bad' => {
    if (hf === null || hf >= 1.5) return 'good';
    if (hf >= 1.1) return 'warn';
    return 'bad';
};

export const shortAddress = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;
