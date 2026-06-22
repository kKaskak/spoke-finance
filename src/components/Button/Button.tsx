import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';

type Variant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'supply' | 'borrow' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    block?: boolean;
    loading?: boolean;
    children: ReactNode;
};

export const Button = ({
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    disabled,
    className,
    children,
    ...rest
}: Props) => (
    <button
        className={[styles.btn, styles[variant], styles[size], block ? styles.block : '', className]
            .filter(Boolean)
            .join(' ')}
        disabled={disabled || loading}
        {...rest}
    >
        {loading && <span className={styles.spinner} />}
        <span className={loading ? styles.hidden : undefined}>{children}</span>
    </button>
);
