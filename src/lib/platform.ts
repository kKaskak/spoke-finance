export type PlatformKey = 'aave-v4' | 'aave-v3' | 'morpho' | 'fluid';

export const PLATFORM_LABEL: Record<PlatformKey, string> = {
    'aave-v4': 'Aave v4',
    'aave-v3': 'Aave v3',
    morpho: 'Morpho',
    fluid: 'Fluid'
};

export const PLATFORM_COLOR: Record<PlatformKey, string> = {
    'aave-v4': '#0071e3',
    'aave-v3': '#5e5ce6',
    morpho: '#34c759',
    fluid: '#ff9500'
};
