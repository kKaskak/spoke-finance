type EthersError = {
    code?: string | number;
    shortMessage?: string;
    reason?: string;
    message?: string;
    info?: { error?: { code?: number; message?: string } };
};

export const parseTxError = (e: unknown): string => {
    const err = e as EthersError;
    const innerCode = err.info?.error?.code;
    if (err.code === 'ACTION_REJECTED' || err.code === 4001 || innerCode === 4001) {
        return 'Transaction rejected in wallet';
    }
    const msg = err.shortMessage ?? err.reason ?? err.message ?? '';
    if (/insufficient funds/i.test(msg)) return 'Insufficient ETH balance';
    if (/user (rejected|denied)/i.test(msg)) return 'Transaction rejected in wallet';
    if (/missing revert data|cannot estimate gas|unpredictable gas/i.test(msg)) {
        return 'Could not estimate gas — check your balance and network';
    }
    if (/no wallet/i.test(msg)) return 'No wallet found';
    if (err.shortMessage) return err.shortMessage;
    if (err.reason) return err.reason;
    return 'Something went wrong. Please try again.';
};
