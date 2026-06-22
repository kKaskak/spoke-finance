import { BrowserProvider, type Eip1193Provider, type Signer } from 'ethers';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CHAIN_ID } from '@shared/constants';

type Eip1193 = Eip1193Provider & {
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
    interface Window {
        ethereum?: Eip1193;
    }
}

type WalletState = {
    account: string | null;
    chainId: number | null;
    hasWallet: boolean;
    connecting: boolean;
    isWrongChain: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    switchChain: () => Promise<void>;
    getSigner: () => Promise<Signer>;
};

const WalletContext = createContext<WalletState | null>(null);

const eth = () => {
    if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
    return window.ethereum;
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
    const [account, setAccount] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [connecting, setConnecting] = useState(false);
    const hasWallet = typeof window !== 'undefined' && !!window.ethereum;

    useEffect(() => {
        const provider = window.ethereum;
        if (!provider) return;
        const onAccounts = (...args: unknown[]) => {
            const accounts = args[0] as string[];
            setAccount(accounts[0] ?? null);
        };
        const onChain = (...args: unknown[]) => setChainId(parseInt(args[0] as string, 16));

        provider.request({ method: 'eth_accounts' }).then((a) => onAccounts(a));
        provider.request({ method: 'eth_chainId' }).then((c) => onChain(c));
        provider.on?.('accountsChanged', onAccounts);
        provider.on?.('chainChanged', onChain);
        return () => {
            provider.removeListener?.('accountsChanged', onAccounts);
            provider.removeListener?.('chainChanged', onChain);
        };
    }, []);

    const connect = useCallback(async () => {
        setConnecting(true);
        try {
            const accounts = (await eth().request({ method: 'eth_requestAccounts' })) as string[];
            setAccount(accounts[0] ?? null);
            const c = (await eth().request({ method: 'eth_chainId' })) as string;
            setChainId(parseInt(c, 16));
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => setAccount(null), []);

    const switchChain = useCallback(async () => {
        await eth().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }] });
    }, []);

    const getSigner = useCallback(async () => {
        const browser = new BrowserProvider(eth());
        return browser.getSigner();
    }, []);

    const value = useMemo<WalletState>(
        () => ({
            account,
            chainId,
            hasWallet,
            connecting,
            isWrongChain: account !== null && chainId !== null && chainId !== CHAIN_ID,
            connect,
            disconnect,
            switchChain,
            getSigner
        }),
        [account, chainId, hasWallet, connecting, connect, disconnect, switchChain, getSigner]
    );

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletState => {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error('useWallet must be used within WalletProvider');
    return ctx;
};
