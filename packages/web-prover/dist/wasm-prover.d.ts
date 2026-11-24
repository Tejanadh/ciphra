/**
 * Local proving in the browser, wired into the SDK without patching it.
 *
 * `ProverClient` takes an injectable `fetch`, and the runtime's `prove`
 * accepts and returns exactly the JSON a `POST /prove/<key>` exchange uses (it mirrors
 * `server.processProofSync`). So the whole integration is a `fetch` that
 * recognizes the prover URL and answers it from wasm instead of the network.
 * Everything else -- indexer calls, Solana RPC -- falls through untouched.
 *
 * The runtime is zopro-spr built for the browser: Zolana's request and
 * proof formats, gnark's keys repacked as zopro key files.
 */
import type { KeyProgress, Measurement } from "./measurement.js";
export { WasmProverError } from "./errors.js";
import { type ProvingKeyStatus, type KeyCacheStorage } from "./key-store.js";
import type { ProvingKeyCatalog, ProvingKeySource } from "./key-catalog.js";
import { type ShapeKey } from "./shapes.js";
/** Messages the worker understands. Mirrored by `prover.worker.ts`. */
export type WorkerRequest = Readonly<{
    id: number;
    kind: "init";
    threads: number;
    gpu?: "auto" | "off" | "required";
    residentKeyBudgetBytes?: number;
}> | Readonly<{
    id: number;
    kind: "loadKey";
    fileName: string;
    /** The pinned key file, or the raw form of an earlier load. */
    key: ArrayBuffer;
    /** The gnark proving key's sha256 the key file was built from, which proofs report. */
    keySha256: string;
    /** Ask for the raw form back, to cache. */
    exportRaw: boolean;
    /** Pinned compressed size, for conservative resident-cache accounting. */
    keyBytes?: number;
}> | Readonly<{
    id: number;
    kind: "selectKey";
    fileName: string;
    keySha256: string;
}> | Readonly<{
    id: number;
    kind: "prove";
    body: string;
}> | Readonly<{
    id: number;
    kind: "loadedKeys";
}>;
/** The message surface shared by browser workers and Node worker threads. */
export interface ProverWorker {
    addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
    addEventListener(type: "error" | "messageerror", listener: (event: Event) => void): void;
    postMessage(message: unknown, transfer: ArrayBuffer[]): void;
    terminate(): void;
}
export type WorkerFatal = Readonly<{
    fatal: true;
    error: string;
}>;
export type WorkerResponse = Readonly<{
    id: number;
    ok: boolean;
    /** Present when ok; shape depends on the request kind. */
    value?: unknown;
    error?: string;
    /** Time spent inside the worker, so the page reports proving cost honestly. */
    ms: number;
}>;
export interface WasmProverOptions {
    /**
     * Opt-in LRU cache of loaded provers. 0 (default) keeps one shape.
     * Estimated key-state budget, at most 1 GiB; not a process/GPU memory limit.
     * Oversized keys run alone. Leave additional memory for decoding and proofs.
     */
    readonly residentKeyBudgetBytes?: number;
    /** GPU acceleration when available (default), CPU only, or fail if unavailable. */
    readonly gpu?: "auto" | "off" | "required";
    /** Override persistent key storage. Node uses a disk cache. */
    readonly cacheStorage?: KeyCacheStorage;
    /**
     * Threads of the proving pool (one or more; omit to choose automatically), or
     * `0` for the single-thread runtime without SharedArrayBuffer.
     */
    readonly threads?: number;
    /**
     * Where proving keys are fetched from. Omit it to use the pinned key set on
     * the Zolana CDN, which serves them with CORS; set it to self-host or mirror
     * them, as `spr-prover-keys` installs.
     */
    readonly keyBaseUrl?: string;
    /**
     * A supplied /proving-keys catalog. Its zopro URLs replace the default CDN;
     * both artifact and source-key digests must match the bundled pins. Missing
     * conversions fail locally. Mutually exclusive with keyBaseUrl; never fetched
     * automatically and requires no TEE policy.
     */
    readonly keyCatalog?: ProvingKeyCatalog;
    /** Trusted runtime keys from an authenticated source, such as `client.fetchProvingKeySet()`.
     * Mutually exclusive with keyCatalog and keyBaseUrl. */
    readonly keySource?: ProvingKeySource;
    /** The prover URL handed to the SDK; requests to it are intercepted. */
    readonly proverUrl: string;
    readonly fetch?: typeof globalThis.fetch;
    /** Override worker construction for tests or a custom bundler. */
    readonly workerFactory?: () => ProverWorker;
    /** Called for each timed worker operation so the UI can chart it. */
    readonly onMeasurement?: (measurement: Measurement) => void;
    /** Called as each proving key downloads and when the worker starts decoding it. */
    readonly onKeyProgress?: (progress: KeyProgress) => void;
    /**
     * Ask the browser to keep cached keys under storage pressure
     * (`navigator.storage.persist()`). Firefox shows the user a prompt for it.
     */
    readonly persistStorage?: boolean;
}
/**
 * Owns the worker and the queue of its work; the keys live in a `KeyStore`
 * and the SDK's `fetch` comes from `createProverFetch`.
 */
export declare class WasmProver {
    #private;
    /** Whether initialization found a GPU; each proof reports its actual backend. */
    get gpuAvailable(): boolean;
    get threads(): number;
    constructor(options: WasmProverOptions);
    /**
     * Starts the worker and instantiates the runtime.
     *
     * The runtime must run in a worker: a proof blocks its thread for seconds,
     * so on the main thread it would freeze the page for the whole proof.
     */
    start(source?: ProverWorker | (() => ProverWorker) | undefined): Promise<void>;
    /** Downloads (or reads from cache) and deserializes one shape's proving key. */
    ensureKey(shape: ShapeKey, signal?: AbortSignal): Promise<void>;
    /**
     * Downloads, checks and decodes `shapes` ahead of the proofs that need them, so
     * a first proof doesn't wait seconds for its key. With the Cache API each
     * shape's decoded form is kept and later loads take a fraction of a second;
     * shapes already kept are skipped. Each shape is queued on its own, so a proof
     * requested meanwhile runs after the shape in progress. Aborting skips the
     * remaining shapes; aborting the one in progress restarts the worker. Without
     * the Cache API decoded forms are not persisted; the resident budget still applies.
     */
    prefetch(options: Readonly<{
        shapes: readonly ShapeKey[];
        signal?: AbortSignal;
        onProgress?: (progress: KeyProgress) => void;
    }>): Promise<void>;
    /**
     * Every key the prover can load, smallest first, with what the browser keeps of
     * it. Reads the cache only: the worker need not be running, and a prefetch or
     * proof may be downloading meanwhile.
     */
    provingKeys(signal?: AbortSignal): Promise<readonly ProvingKeyStatus[]>;
    /**
     * Removes the kept keys, their decoded forms and interrupted downloads. A
     * prefetch or proof in progress finishes first; resident keys stay loaded.
     */
    clearKeys(signal?: AbortSignal): Promise<void>;
    /**
     * A `fetch` for `SprClientConfig.fetch`. Proof requests to `/prove/<key>`
     * are answered by the runtime, other paths below `/prove` are refused, and
     * everything else is delegated, so one shim covers the client.
     */
    createFetch(): typeof globalThis.fetch;
    /**
     * Prove and verify one request locally, keeping key switching atomic.
     * Aborting queued work leaves the active request alone. Aborting active work
     * discards the runtime and rejects its other outstanding requests. A factory
     * supplied to start() lets a later request initialize a fresh worker.
     */
    proveRequest(body: string, signal?: AbortSignal): Promise<{
        proof: string;
        proveMs: number;
        verifyMs: number;
        backend?: "gpu" | "cpu";
    }>;
    loadedKeys(): Promise<readonly string[]>;
    terminate(): void;
}
