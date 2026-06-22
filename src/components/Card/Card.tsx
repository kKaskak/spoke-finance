import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.scss';

type Props = HTMLAttributes<HTMLDivElement> & {
    title?: ReactNode;
    action?: ReactNode;
    pad?: boolean;
    children: ReactNode;
};

export const Card = ({ title, action, pad = true, className, children, ...rest }: Props) => (
    <div className={[styles.card, className].filter(Boolean).join(' ')} {...rest}>
        {(title || action) && (
            <div className={styles.head}>
                {title && <h3 className={styles.title}>{title}</h3>}
                {action}
            </div>
        )}
        <div className={pad ? styles.body : undefined}>{children}</div>
    </div>
);
