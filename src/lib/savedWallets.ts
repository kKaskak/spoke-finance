import { useSyncExternalStore } from 'react';

export type SavedWallet = { address: string; label: string };

const KEY = 'spoke:wallets';
const listeners = new Set<() => void>();

const read = (): SavedWallet[] => {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
        return [];
    }
};

let wallets = read();

const write = (next: SavedWallet[]) => {
    wallets = next;
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

export const useSavedWallets = () => useSyncExternalStore(subscribe, () => wallets);

export const saveWallet = (address: string, label: string) =>
    write([...wallets.filter((w) => w.address !== address), { address, label }]);

export const removeWallet = (address: string) => write(wallets.filter((w) => w.address !== address));
