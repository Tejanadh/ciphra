/**
 * Proving keys in the browser's Cache API.
 *
 * Keys are zopro key files of 7-315 MB each and immutable (the lockfile pins
 * their sha256 and the CloudFront prefix is version-hashed), so re-downloading
 * one per page load is pure waste. A key downloads in ranged parts, several at
 * a time, each kept as it arrives, so an interrupted download resumes with the
 * parts it lacks. After a shape's first load the store keeps the runtime's raw
 * form instead of the pinned file's parts: the pinned file's compressed points
 * take seconds to decompress in wasm on every load, and the raw form skips that
 * and the solver's build.
 */
import { type ProvingKeyCatalog, type ProvingKeySource } from "./key-catalog.js";
import { type ShapeKey } from "./shapes.js";
/** One entry of `KEY_DIGESTS`, copied from `zopro-keys.lock`. */
export interface KeyDigest {
    /** The zopro key file, the object name under the key base URL. */
    readonly file: string;
    readonly size: number;
    readonly sha256: string;
    /** The gnark proving key the file was built from, which proofs report. */
    readonly keySha256: string;
}
/** A proving key the prover can load and how much of it the browser keeps. */
export interface ProvingKeyStatus {
    /** The gnark proving key's name, as `ShapeKey.keyFile`. */
    readonly keyFile: string;
    /** The zopro key file's size in the lockfile. */
    readonly size: number;
    /**
     * Bytes the browser keeps: `size` once the key downloaded, what an interrupted
     * download left otherwise.
     */
    readonly downloaded: number;
    /** Whether its decoded form is kept, so its next load skips decompression. */
    readonly decoded: boolean;
}
/** A key's bytes: the pinned file, or the raw form the runtime wrote at an earlier load. */
export type KeyBytes = Readonly<{
    bytes: ArrayBuffer;
    raw: boolean;
    source: "cache" | "network";
    /** Whether the store can keep this key's raw form. */
    cacheable: boolean;
}>;
/** Storage operations used by the key cache; Node supplies a disk implementation. */
export interface KeyCache {
    match(url: string): Promise<Response | undefined>;
    put(url: string, response: Response): Promise<void>;
    delete(url: string): Promise<boolean>;
}
export interface KeyCacheStorage {
    open(name: string): Promise<KeyCache>;
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
}
export interface KeyStoreOptions {
    readonly cacheStorage?: KeyCacheStorage;
    /** Where keys are fetched from; the pinned key set on the Zolana CDN by default. */
    readonly keyBaseUrl?: string;
    /** Download URLs from /proving-keys, checked against the bundled pins. */
    readonly keyCatalog?: ProvingKeyCatalog;
    readonly keySource?: ProvingKeySource;
    readonly fetch: typeof globalThis.fetch;
    /** Ask the browser to keep the keys under storage pressure. */
    readonly persistStorage?: boolean;
}
export declare class KeyStore {
    #private;
    constructor(options: KeyStoreOptions);
    /** The URL of the shape's zopro key file. */
    url(shape: ShapeKey): string;
    /** The shape's pinned key file, size and sha256; a shape outside the key set has none. */
    digest(shape: ShapeKey): KeyDigest;
    /** Every key, smallest first, with what the browser keeps of it. */
    status(signal: AbortSignal): Promise<readonly ProvingKeyStatus[]>;
    /** Removes the kept keys, their raw forms and interrupted downloads. */
    clear(signal: AbortSignal): Promise<void>;
    /** Whether the store keeps this shape's raw form, written by a runtime of `rawKeyFormat`. */
    rawKept(shape: ShapeKey, rawKeyFormat: string, signal: AbortSignal): Promise<boolean>;
    /**
     * The shape's key: its raw form when kept, else the pinned file from the
     * cache or, downloaded in parts, from the network.
     */
    load(shape: ShapeKey, rawKeyFormat: string, signal: AbortSignal, downloaded?: (loaded: number) => void): Promise<KeyBytes>;
    /** The pinned file, after forgetting a raw form the runtime rejected. */
    reload(shape: ShapeKey, signal: AbortSignal, downloaded?: (loaded: number) => void): Promise<KeyBytes>;
    /** Keeps the raw form in place of the pinned file and its parts, which are no longer read. */
    keepRaw(shape: ShapeKey, rawKeyFormat: string, raw: Uint8Array<ArrayBuffer>, signal: AbortSignal): Promise<void>;
}
