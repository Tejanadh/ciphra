import { WasmProver, type WasmProverOptions } from "../wasm-prover.js";
export * from "../index.js";
export interface NodeProverOptions extends Omit<WasmProverOptions, "workerFactory" | "persistStorage" | "cacheStorage"> {
    /** Directory for verified downloads and decoded keys; false disables persistence. */
    readonly cacheDir?: string | false;
}
/** Local WASM proofs in Node, with Rayon threads and optional Dawn WebGPU. */
export declare class SprNodeProver extends WasmProver {
    constructor(options: NodeProverOptions);
}
