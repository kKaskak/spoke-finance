import { motion } from 'motion/react';
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
    return (
        <div className={styles.shell}>
            <header className={styles.nav}>
                <div className={styles.inner}>
                    <NavLink to="/" className={styles.brand}>
                        <span className={styles.mark} />
                        Aave <span className={styles.brandDim}>v4</span>
                    </NavLink>
                    <nav className={styles.tabs}>
                        {tabs.map((t) => (
                            <NavLink key={t.to} to={t.to} end={t.end} className={styles.tab}>
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <motion.span
                                                layoutId="navTab"
                                                className={styles.tabBg}
                                                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                                            />
                                        )}
                                        <span
                                            className={[styles.tabLabel, isActive ? styles.tabLabelActive : ''].join(' ')}
                                        >
                                            {t.label}
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                    <div className={styles.right}>
                        <Support />
                        <WalletButton />
                    </div>
                </div>
            </header>
            <main className={styles.main}>
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
            </main>
        </div>
    );
};
