import { useState } from 'react';
import { PLATFORM_COLOR, PLATFORM_LABEL, PLATFORM_LOGO, PLATFORM_MARK, type PlatformKey } from '@/lib/platform';
import styles from './PlatformIcon.module.scss';

type Props = {
    platform: PlatformKey;
    size?: number;
};

export const PlatformIcon = ({ platform, size = 30 }: Props) => {
    const [failed, setFailed] = useState(false);
    const dims = { width: size, height: size };

    if (failed) {
        return (
            <div
                className={styles.fallback}
                style={{ ...dims, fontSize: size * 0.42, background: `${PLATFORM_COLOR[platform]}1f`, color: PLATFORM_COLOR[platform] }}
            >
                {PLATFORM_MARK[platform]}
            </div>
        );
    }
    return (
        <img
            className={styles.icon}
            style={dims}
            src={PLATFORM_LOGO[platform]}
            alt={PLATFORM_LABEL[platform]}
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
};
