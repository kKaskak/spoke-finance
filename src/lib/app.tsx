import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ActionDrawer } from '@/components/ActionDrawer/ActionDrawer';
import type { ActionKind } from '@shared/types';
import { usePlatforms, type OtherPlatforms } from './usePlatforms';
import { usePortfolio, type Portfolio } from './usePortfolio';

export type PooledPlatform = 'aave-v4' | 'aave-v3';
export type PairPlatform = 'morpho' | 'fluid';

export type ActionTarget =
    | { platform: PooledPlatform; kind: ActionKind; reserveId: number }
    | { platform: PairPlatform; kind: ActionKind; marketId: string };

type AppState = {
    portfolio: Portfolio;
    otherPlatforms: OtherPlatforms;
    openAction: (platform: PooledPlatform, reserveId: number, kind: ActionKind) => void;
    openPairAction: (platform: PairPlatform, marketId: string, kind: ActionKind) => void;
};

const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const portfolio = usePortfolio();
    const otherPlatforms = usePlatforms();
    const [target, setTarget] = useState<ActionTarget | null>(null);

    const value = useMemo<AppState>(
        () => ({
            portfolio,
            otherPlatforms,
            openAction: (platform, reserveId, kind) => setTarget({ platform, reserveId, kind }),
            openPairAction: (platform, marketId, kind) => setTarget({ platform, marketId, kind })
        }),
        [portfolio, otherPlatforms]
    );

    const onSuccess = () => {
        portfolio.refresh();
        otherPlatforms.refresh();
    };

    return (
        <AppContext.Provider value={value}>
            {children}
            <ActionDrawer
                target={target}
                portfolio={portfolio}
                otherPlatforms={otherPlatforms}
                onClose={() => setTarget(null)}
                onSuccess={onSuccess}
            />
        </AppContext.Provider>
    );
};

export const useApp = (): AppState => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
