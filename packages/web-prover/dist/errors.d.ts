declare const messages: {
    readonly wasm_prover_error: "Prover operation failed";
    readonly wasm_init_failed: "Prover initialization failed; check runtime assets, threads and isolation headers";
    readonly wasm_gpu_unavailable: "GPU acceleration is unavailable; check WebGPU support and, in Node, install the webgpu peer";
    readonly wasm_worker_failed: "Prover worker failed";
    readonly wasm_worker_not_started: "Prover worker is not started";
    readonly wasm_worker_terminated: "Prover worker terminated";
    readonly wasm_invalid_response: "Invalid prover response";
    readonly wasm_invalid_request: "Unsupported circuit or malformed request";
    readonly wasm_merge_too_wide: "The browser merges at most 24 notes";
    readonly wasm_key_manifest_error: "The proving key is not in the pinned key set";
    readonly wasm_key_catalog_invalid: "Invalid proving-key catalog or conflicting key source configuration";
    readonly wasm_key_download_failed: "Proving-key download failed";
    readonly wasm_key_digest_mismatch: "Proving key does not match the lockfile; stage the pinned assets";
    readonly wasm_key_load_failed: "Proving-key loading failed";
    readonly wasm_prove_failed: "Proof generation failed";
    readonly wasm_verify_failed: "The proof did not verify";
};
export type WasmProverErrorCode = keyof typeof messages;
export declare class WasmProverError extends Error {
    readonly code: WasmProverErrorCode;
    constructor(code?: WasmProverErrorCode);
}
export declare function operationError(kind: string): WasmProverError;
/**
 * The error of a failed worker operation: the worker's code when it is one of
 * ours (a key built from another gnark key, a proof that did not verify), else
 * the operation's. The worker sends codes only, never messages.
 */
export declare function workerError(kind: string, code: unknown): WasmProverError;
export {};
