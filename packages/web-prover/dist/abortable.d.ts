/** Race work against cancellation even when an I/O implementation ignores signals. */
export declare function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T>;
/** Rethrows a cancellation, so a caller that swallows other errors still stops. */
export declare function rethrowAbort(error: unknown, signal?: AbortSignal): void;
