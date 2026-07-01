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

export const PLATFORM_SHORT: Record<PlatformKey, string> = {
    'aave-v4': 'v4',
    'aave-v3': 'v3',
    morpho: '',
    fluid: ''
};

export const PLATFORM_MARK: Record<PlatformKey, string> = {
    'aave-v4': '4',
    'aave-v3': '3',
    morpho: 'M',
    fluid: 'F'
};

export const PLATFORM_LOGO: Record<PlatformKey, string> = {
    'aave-v4': 'https://icons.llama.fi/aave-v3.png',
    'aave-v3': 'https://icons.llama.fi/aave-v3.png',
    morpho: 'https://icons.llama.fi/morpho-blue.png',
    fluid: 'https://icons.llama.fi/fluid.png'
};
