import { useState } from 'react';
import { PLATFORM_COLOR, PLATFORM_LABEL, PLATFORM_LOGO, PLATFORM_MARK, type PlatformKey } from '@/lib/platform';
import styles from './PlatformIcon.module.scss';

type Props = {
    platform: PlatformKey;
    size?: number;
};

// Aave v4 and v3 share the same brand mark, so overlay a small version badge to keep them visually distinct
const isAave = (platform: PlatformKey) => platform === 'aave-v4' || platform === 'aave-v3';

export const PlatformIcon = ({ platform, size = 30 }: Props) => {
    const [failed, setFailed] = useState(false);
    const dims = { width: size, height: size };

    const icon = failed ? (
        <div
            className={styles.fallback}
            style={{ ...dims, fontSize: size * 0.42, background: `${PLATFORM_COLOR[platform]}1f`, color: PLATFORM_COLOR[platform] }}
        >
            {PLATFORM_MARK[platform]}
        </div>
    ) : (
        <img
            className={styles.icon}
            style={dims}
            src={PLATFORM_LOGO[platform]}
            alt={PLATFORM_LABEL[platform]}
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );

    if (!isAave(platform) || failed) return icon;

    const badgeSize = Math.max(12, Math.round(size * 0.5));
    return (
        <span className={styles.wrap} style={dims}>
            {icon}
            <span className={styles.badge} style={{ width: badgeSize, height: badgeSize, fontSize: badgeSize * 0.62 }}>
                {PLATFORM_MARK[platform]}
            </span>
        </span>
    );
};
