/* tslint:disable */
/* eslint-disable */

export class Key {
    free(): void;
    [Symbol.dispose](): void;
    add_commitment(basis: Uint8Array, sigma: Uint8Array): void;
    commitment(index: number, knowledge: boolean, values: Uint8Array): Uint8Array;
    /**
     * Proves on the CPU from now on: a host whose GPU failed, or whose GPU
     * proof did not verify, lets the GPU go. The CPU proves with the
     * points in the key's image (`Points::Mapped`), or in a browser with
     * its own copy. Natively, points decoded from a host's bytes have
     * their only copy on the GPU: the key keeps its GPU and fails, and
     * `drop_gpu_with` takes the points again.
     */
    drop_gpu(): void;
    /**
     * Whether the key holds a GPU (in a browser, the page's: solve_parts_gpu
     * proves with it).
     */
    has_gpu(): boolean;
    constructor(a: Uint8Array, b: Uint8Array, k: Uint8Array, z: Uint8Array, b2: Uint8Array, domain_params: Uint8Array);
    parts(sa: Uint8Array, sb: Uint8Array, sk: Uint8Array, a: Uint8Array, b: Uint8Array, c: Uint8Array): Uint8Array;
    set_solver(program: Uint8Array, coefficients: Uint8Array): boolean;
    set_solver_image(image: Uint8Array): boolean;
    /**
     * `solve_parts` for hosts outside JavaScript, with a plain error.
     */
    solve(witness: Uint8Array): Uint8Array;
    solve_parts(witness: Uint8Array): Uint8Array;
    /**
     * solve_parts with the GPU, in a browser: a Promise of the parts. The
     * solve, the GPU's submissions and the CPU's share of the G2 MSM run
     * now; the GPU's results are awaited, the quotient's first so that Z's
     * MSM follows the others.
     */
    solve_parts_gpu(witness: Uint8Array): Promise<any>;
    solver_image(): Uint8Array | undefined;
}

export class SprProver {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The sha256 of the gnark key the zopro key was built from, hex.
     */
    digest(): string;
    /**
     * Proves on the CPU from now on.
     */
    drop_gpu(): void;
    /**
     * The raw form to cache, once per load of a key file; empty after.
     */
    export_raw(): Uint8Array;
    /**
     * Loads a zopro key file whose vectors a page decompressed in workers
     * (`key_vectors`, `kernel_points`), each joined in order.
     */
    static from_vectors(key: Uint8Array, a: Uint8Array, b: Uint8Array, k: Uint8Array, z: Uint8Array, b2: Uint8Array): SprProver;
    has_gpu(): boolean;
    inputs(): number;
    name(): string;
    /**
     * Loads a zopro key file, or the raw form an earlier load exported.
     */
    constructor(key: Uint8Array);
    outputs(): number;
    /**
     * A Promise of `{proof, witnessMs, proveMs, verifyMs}`, `proof` the
     * JSON string the prover server returns. It rejects with "unverified"
     * when the proof did not verify (a GPU at fault: call `drop_gpu` and
     * prove again), else with the request's error.
     */
    prove(request: string): Promise<any>;
    /**
     * Whether `proof_json` (the SDKs' proof JSON) proves `request`'s public
     * input with this key.
     */
    verify(request: string, proof_json: string): boolean;
}

export class WebProver {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Proves on the CPU from now on.
     */
    drop_gpu(): void;
    /**
     * The raw form to cache, once per load of a key file; empty after, and
     * after a load of the raw form.
     */
    export_raw(): Uint8Array;
    /**
     * Loads a zopro key file whose vectors a page decompressed
     * (`key_vectors`, `kernel_points`), each joined in order.
     */
    static from_vectors(key: Uint8Array, a: Uint8Array, b: Uint8Array, k: Uint8Array, z: Uint8Array, b2: Uint8Array): WebProver;
    has_gpu(): boolean;
    metadata(): Uint8Array;
    name(): string;
    /**
     * The inputs' names, public then secret.
     */
    names(): string[];
    /**
     * Loads a zopro key file, or the raw form an earlier load exported.
     */
    constructor(key: Uint8Array);
    /**
     * A Promise of `{proof, publicWitness, proveMs, verifyMs}` for an
     * object of the inputs' values by name (decimal, or `0x` and hex):
     * gnark's compressed proof and binary public witness. It rejects with
     * "unverified" when the proof did not verify (a GPU at fault: call
     * `drop_gpu` and prove again).
     */
    prove(assignment: any): Promise<any>;
    public_inputs(): number;
}

/**
 * `compressed` G1 points (32 bytes each) as raw points (64 bytes each).
 */
export function decompress_g1(compressed: Uint8Array): Uint8Array;

/**
 * `compressed` G2 points (64 bytes each) as raw points (128 bytes each).
 */
export function decompress_g2(compressed: Uint8Array): Uint8Array;

/**
 * What the GPU has allocated for this process, in bytes (Metal only; zero
 * elsewhere): the bench's stress mode watches it for leaks.
 */
export function gpu_allocated_bytes(): bigint;

/**
 * Per-kernel GPU times from timestamp queries for the proofs after the
 * next `init_gpu` (`gpu_profile_report` gives them): a profile, not for
 * production proofs.
 */
export function gpu_profile(on: boolean): void;

/**
 * The kernels' GPU times since the last report, a line each:
 * `kernel total_ms ms passes passes`.
 */
export function gpu_profile_report(): string;

export function initThreadPool(num_threads: number): Promise<any>;

/**
 * Requests the page's WebGPU device for the keys built after it: their
 * MSMs and quotient go to the GPU through solve_parts_gpu. False without
 * WebGPU (the keys then prove on the CPU).
 */
export function init_gpu(): Promise<boolean>;

/**
 * Compressed points of a key file's vector (G2 for b2) in the kernel's
 * encoding.
 */
export function kernel_points(compressed: Uint8Array, g2: boolean): Uint8Array;

/**
 * Where a key file's vectors of compressed points lie: byte offset and
 * length of a, b, k, z (G1, 32 bytes a point) and b2 (G2, 64), in turn.
 * A page without a thread pool splits each into runs of whole points,
 * decompresses them in workers (`kernel_points`) and loads the key from
 * the results (`from_vectors`).
 */
export function key_vectors(key: Uint8Array): Uint32Array;

/**
 * The raw form `export_raw` writes, for a page's cache to check.
 */
export function raw_format(): string;

export class wbg_rayon_PoolBuilder {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    build(): void;
    numThreads(): number;
    receiver(): number;
}

export function wbg_rayon_start_worker(receiver: number): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly __wbg_key_free: (a: number, b: number) => void;
    readonly __wbg_sprprover_free: (a: number, b: number) => void;
    readonly __wbg_wbg_rayon_poolbuilder_free: (a: number, b: number) => void;
    readonly __wbg_webprover_free: (a: number, b: number) => void;
    readonly decompress_g1: (a: number, b: number) => [number, number, number, number];
    readonly decompress_g2: (a: number, b: number) => [number, number, number, number];
    readonly gpu_allocated_bytes: () => bigint;
    readonly gpu_profile: (a: number) => void;
    readonly gpu_profile_report: () => [number, number];
    readonly initThreadPool: (a: number) => any;
    readonly init_gpu: () => any;
    readonly kernel_points: (a: number, b: number, c: number) => [number, number, number, number];
    readonly key_add_commitment: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly key_commitment: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly key_drop_gpu: (a: number) => [number, number];
    readonly key_has_gpu: (a: number) => number;
    readonly key_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number];
    readonly key_parts: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => [number, number, number, number];
    readonly key_set_solver: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly key_set_solver_image: (a: number, b: number, c: number) => number;
    readonly key_solve: (a: number, b: number, c: number) => [number, number, number, number];
    readonly key_solve_parts: (a: number, b: number, c: number) => [number, number, number, number];
    readonly key_solve_parts_gpu: (a: number, b: number, c: number) => [number, number, number];
    readonly key_solver_image: (a: number) => [number, number];
    readonly key_vectors: (a: number, b: number) => [number, number, number, number];
    readonly raw_format: () => [number, number];
    readonly sprprover_digest: (a: number) => [number, number];
    readonly sprprover_drop_gpu: (a: number) => [number, number];
    readonly sprprover_export_raw: (a: number) => any;
    readonly sprprover_from_vectors: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number];
    readonly sprprover_has_gpu: (a: number) => number;
    readonly sprprover_inputs: (a: number) => number;
    readonly sprprover_name: (a: number) => [number, number];
    readonly sprprover_new: (a: number, b: number) => [number, number, number];
    readonly sprprover_outputs: (a: number) => number;
    readonly sprprover_prove: (a: number, b: number, c: number) => [number, number, number];
    readonly sprprover_verify: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wbg_rayon_poolbuilder_build: (a: number) => void;
    readonly wbg_rayon_poolbuilder_numThreads: (a: number) => number;
    readonly wbg_rayon_poolbuilder_receiver: (a: number) => number;
    readonly wbg_rayon_start_worker: (a: number) => void;
    readonly webprover_drop_gpu: (a: number) => [number, number];
    readonly webprover_export_raw: (a: number) => any;
    readonly webprover_from_vectors: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number];
    readonly webprover_has_gpu: (a: number) => number;
    readonly webprover_metadata: (a: number) => any;
    readonly webprover_name: (a: number) => [number, number];
    readonly webprover_names: (a: number) => [number, number];
    readonly webprover_new: (a: number, b: number) => [number, number, number];
    readonly webprover_prove: (a: number, b: any) => [number, number, number];
    readonly webprover_public_inputs: (a: number) => number;
    readonly wasm_bindgen__convert__closures_____invoke__h36fb09060cf59cc0: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h50bd588c568bd794: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h65aaa17693702354: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h65aaa17693702354_54: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h65aaa17693702354_55: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h06af5fc071ca5c19: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h06af5fc071ca5c19_52: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h06af5fc071ca5c19_53: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__hc6c5399290337b8a: (a: number, b: number, c: any) => void;
    readonly memory: WebAssembly.Memory;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_thread_destroy: (a?: number, b?: number, c?: number) => void;
    readonly __wbindgen_start: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput, memory?: WebAssembly.Memory, thread_stack_size?: number }} module - Passing `SyncInitInput` directly is deprecated.
 * @param {WebAssembly.Memory} memory - Deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput, memory?: WebAssembly.Memory, thread_stack_size?: number } | SyncInitInput, memory?: WebAssembly.Memory): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput>, memory?: WebAssembly.Memory, thread_stack_size?: number }} module_or_path - Passing `InitInput` directly is deprecated.
 * @param {WebAssembly.Memory} memory - Deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput>, memory?: WebAssembly.Memory, thread_stack_size?: number } | InitInput | Promise<InitInput>, memory?: WebAssembly.Memory): Promise<InitOutput>;
