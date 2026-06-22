import type { CSSProperties } from 'react';
import styles from './Skeleton.module.scss';

type Props = {
    width?: number | string;
    height?: number | string;
    radius?: number | string;
    className?: string;
};

export const Skeleton = ({ width = '100%', height = 16, radius = 8, className }: Props) => {
    const style: CSSProperties = { width, height, borderRadius: radius };
    return <span className={[styles.skeleton, className].filter(Boolean).join(' ')} style={style} />;
};
