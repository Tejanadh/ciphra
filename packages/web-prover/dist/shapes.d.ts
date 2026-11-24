/**
 * The transfer and merge circuit shapes and the proving keys that back them.
 *
 * The shapes are the keys of the pinned key set, read from `key-digests.ts`
 * (generated from `zopro-keys.lock`, which a downloaded key is also checked
 * against), smallest key first, so the order doubles as the smallest-fit
 * search order; the set mirrors `SPP_SUPPORTED_SHAPES` in the SDK and the
 * on-chain verifier.
 */
export interface Shape {
    readonly inputs: number;
    readonly outputs: number;
}
export interface ShapeKey extends Shape {
    /** `<in>x<out>`, the label used in the UI and benchmark tables. */
    readonly label: string;
    /** The gnark proving key's file name, which names the circuit and its zopro key. */
    readonly keyFile: string;
    /** The zopro key file's size in bytes, from the pinned lockfile. */
    readonly keyBytes: number;
}
/** Confidential (default transact) rail only, ring rail keys are out of scope. */
export declare const TRANSFER_SHAPES: readonly ShapeKey[];
/**
 * The widest merge the browser proves. A wider merge key does not fit in
 * wasm32's 4 GB of memory beside the decoded form the prover caches.
 */
export declare const MAX_BROWSER_MERGE_INPUTS = 24;
/**
 * The merge circuits the browser proves, by input count: those of
 * `SupportedInputCounts` in `spp_merge/shared` up to `MAX_BROWSER_MERGE_INPUTS`.
 */
export declare const MERGE_SHAPES: readonly ShapeKey[];
/** The smallest merge circuit. */
export declare const MERGE_SHAPE: ShapeKey;
export declare const MERGE_KEY_FILE: string;
export declare const MERGE_KEY_BYTES: number;
/**
 * The proving key a `/prove` request needs, resolved from the request itself
 * rather than guessed ahead of time.
 *
 * The protocol derives the shape from the real input/output counts with a
 * smallest-fit rule, so a caller cannot reliably predict which key a given
 * transfer will use; reading it off the request is the only way to be right.
 * Mirrors the server's LazyKeyManager cache key.
 */
export declare function keyForProveRequest(circuitType: string, inputs: number, outputs: number): ShapeKey | undefined;
/** Smallest shape that holds `inputs`/`outputs`, matching `CanonicalShape`. */
export declare function canonicalShape(inputs: number, outputs: number): ShapeKey;
/**
 * The keys spends of up to `maxInputs` notes with `outputs` outputs, and merges of
 * up to `maxMergeInputs` notes, prove with, smallest first, as `prefetch` takes
 * them. A transfer has two outputs, the payment and the change; a withdrawal pads
 * its change to two. The mobile SDK's `ProvingKeys.needed`.
 */
export declare function neededKeys(maxInputs: number, outputs: readonly number[], maxMergeInputs: number): ShapeKey[];
export declare function shapeByLabel(label: string): ShapeKey;
export declare function formatBytes(bytes: number): string;
