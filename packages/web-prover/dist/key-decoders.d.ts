/**
 * Decompression of a key file's points across workers, for the runtime
 * without a thread pool. Decompressing is nearly all of a key's first load (a
 * square root per point: about 20 s of an 8x2 key on one thread), and each
 * point is independent, so plain workers, which need no shared memory, take
 * runs of whole points and the prover loads the key from the joined vectors.
 */
import type { Runtime } from "./runtime.js";
export type DecodeRequest = Readonly<{
    id: number;
    points: ArrayBuffer;
    g2: boolean;
}>;
export type DecodeResponse = Readonly<{
    id: number;
    ok: boolean;
    points?: ArrayBuffer;
}>;
/**
 * The five vectors of `key` (a key file) decompressed by `count` workers from
 * `spawn`, in order, as `SprProver.from_vectors` takes them. Every worker
 * ends when this settles.
 */
export declare function decodeKey(runtime: Pick<Runtime, "key_vectors">, key: Uint8Array, count: number, spawn?: () => Worker): Promise<Uint8Array[]>;
