import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ActionDrawer } from '@/components/ActionDrawer/ActionDrawer';
import type { ActionKind } from '@shared/types';
import { usePlatforms, type OtherPlatforms } from './usePlatforms';
import { usePortfolio, type Portfolio } from './usePortfolio';

export type ActionTarget = { reserveId: number; kind: ActionKind };

type AppState = {
    portfolio: Portfolio;
    otherPlatforms: OtherPlatforms;
    openAction: (reserveId: number, kind: ActionKind) => void;
};

const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const portfolio = usePortfolio();
    const otherPlatforms = usePlatforms();
    const [target, setTarget] = useState<ActionTarget | null>(null);

    const value = useMemo<AppState>(
        () => ({ portfolio, otherPlatforms, openAction: (reserveId, kind) => setTarget({ reserveId, kind }) }),
        [portfolio, otherPlatforms]
    );

    return (
        <AppContext.Provider value={value}>
            {children}
            <ActionDrawer
                target={target}
                reserves={portfolio.reserves}
                account={portfolio.account}
                onClose={() => setTarget(null)}
                onSuccess={portfolio.refresh}
            />
        </AppContext.Provider>
    );
};

export const useApp = (): AppState => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};
