declare const _default: {
    setDebug: (enabled?: boolean) => void;
    log: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
};
export default _default;
