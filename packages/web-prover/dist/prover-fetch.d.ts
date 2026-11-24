/**
 * A `fetch` for `SprClientConfig.fetch`: proof requests to `/prove/<key>`
 * are answered by the local prover, other paths below `/prove` are refused, and
 * everything else is delegated, so one shim covers the client.
 */
import type { Measurement } from "./measurement.js";
export interface ProverFetchOptions {
    /** The prover URL handed to the SDK; requests to it are intercepted. */
    readonly proverUrl: string;
    /** Where every other request goes. */
    readonly fetch: typeof globalThis.fetch;
    readonly onMeasurement?: (measurement: Measurement) => void;
    /** Proves one `/prove` body locally. */
    readonly prove: (body: string, signal?: AbortSignal) => Promise<Readonly<{
        proof: string;
    }>>;
}
export declare function createProverFetch(options: ProverFetchOptions): typeof globalThis.fetch;
