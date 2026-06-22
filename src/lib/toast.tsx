import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EASE } from './motion';
import styles from './toast.module.scss';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; type: ToastType; message: string };

type ToastApi = {
    toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    info: 'i'
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [items, setItems] = useState<ToastItem[]>([]);
    const idRef = useRef(0);

    const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

    const toast = useCallback(
        (message: string, type: ToastType = 'info') => {
            const id = (idRef.current += 1);
            setItems((list) => [...list, { id, type, message }]);
            setTimeout(() => remove(id), 4500);
        },
        [remove]
    );

    const value = useMemo<ToastApi>(() => ({ toast }), [toast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {createPortal(
                <div className={styles.viewport}>
                    <AnimatePresence>
                        {items.map((t) => (
                            <motion.div
                                key={t.id}
                                layout
                                initial={{ opacity: 0, y: -14, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.35, ease: EASE }}
                                className={styles.toast}
                            >
                                <span className={[styles.icon, styles[t.type]].join(' ')}>{ICONS[t.type]}</span>
                                <span className={styles.message}>{t.message}</span>
                                <button className={styles.close} onClick={() => remove(t.id)} aria-label="Dismiss">
                                    ✕
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastApi => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
