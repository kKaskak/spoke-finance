import { motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Support } from '@/components/Support/Support';
import { WalletButton } from '@/components/WalletButton/WalletButton';
import { EASE } from '@/lib/motion';
import styles from './AppShell.module.scss';

const tabs = [
    { to: '/', label: 'Overview', end: true },
    { to: '/markets', label: 'Markets', end: false }
];

export const AppShell = () => {
    const { pathname } = useLocation();
    const activeTab = pathname.startsWith('/markets') ? '/markets' : '/';
    const mainRef = useRef<HTMLElement>(null);
    const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
    const scrollPositions = useRef(new Map<string, number>());
    const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

    useLayoutEffect(() => {
        const el = tabRefs.current[activeTab];
        if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    }, [activeTab]);

    useLayoutEffect(() => {
        const el = mainRef.current;
        if (!el) return;
        el.scrollTop = scrollPositions.current.get(pathname) ?? 0;
        const onScroll = () => scrollPositions.current.set(pathname, el.scrollTop);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [pathname]);

    return (
        <div className={styles.shell}>
            <header className={styles.nav}>
                <div className={styles.inner}>
                    <NavLink to="/" className={styles.brand}>
                        <img src="/favicon.svg" alt="" className={styles.mark} />
                        Spoke
                    </NavLink>
                    <nav className={styles.tabs}>
                        {pill && (
                            <motion.span
                                className={styles.tabBg}
                                initial={false}
                                animate={{ left: pill.left, width: pill.width }}
                                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                            />
                        )}
                        {tabs.map((t) => (
                            <NavLink
                                key={t.to}
                                to={t.to}
                                end={t.end}
                                className={styles.tab}
                                ref={(el) => {
                                    tabRefs.current[t.to] = el;
                                }}
                            >
                                <span
                                    className={[styles.tabLabel, t.to === activeTab ? styles.tabLabelActive : ''].join(' ')}
                                >
                                    {t.label}
                                </span>
                            </NavLink>
                        ))}
                    </nav>
                    <div className={styles.right}>
                        <Support />
                        <WalletButton />
                    </div>
                </div>
            </header>
            <main className={styles.main} ref={mainRef}>
                <div className={styles.content}>
                    <motion.div
                        key={pathname}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                    >
                        <Outlet />
                    </motion.div>
                </div>
                <footer className={styles.footer}>
                    <a
                        href="https://github.com/kKaskak/spoke-finance"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.footerLink}
                    >
                        Open source on GitHub
                    </a>
                </footer>
            </main>
        </div>
    );
};
