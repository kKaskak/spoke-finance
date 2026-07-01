export const FULL_THRESHOLD = 0.98;
export const IDLE_THRESHOLD = 0.001;

export const isNoisyPool = (utilization: number): boolean =>
    utilization >= FULL_THRESHOLD || utilization <= IDLE_THRESHOLD;
