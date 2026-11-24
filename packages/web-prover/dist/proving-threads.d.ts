/**
 * Starting point for the arithmetic pool, using the browser's available logical
 * processors. Cap large machines at the 18-worker configuration benchmarked by
 * this demo. This is a default, not a measurement of the fastest pool size.
 */
export declare function automaticProvingThreads(reported?: number): number;
