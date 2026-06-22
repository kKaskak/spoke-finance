import { animate, motion, useMotionValue } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const EASE = [0.16, 1, 0.3, 1] as const;

type RevealProps = {
    children: ReactNode;
    delay?: number;
    y?: number;
    className?: string;
};

export const Reveal = ({ children, delay = 0, y = 22, className }: RevealProps) => (
    <motion.div
        className={className}
        initial={{ opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, delay, ease: EASE }}
    >
        {children}
    </motion.div>
);

type NumberProps = {
    value: number;
    format: (n: number) => string;
    className?: string;
};

export const AnimatedNumber = ({ value, format, className }: NumberProps) => {
    const mv = useMotionValue(0);
    const formatRef = useRef(format);
    formatRef.current = format;
    const [text, setText] = useState(() => format(value));

    useEffect(() => {
        const unsub = mv.on('change', (v) => setText(formatRef.current(v)));
        const controls = animate(mv, value, { duration: 0.9, ease: EASE });
        return () => {
            controls.stop();
            unsub();
        };
    }, [value, mv]);

    return <span className={className}>{text}</span>;
};
