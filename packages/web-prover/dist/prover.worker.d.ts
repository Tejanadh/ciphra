/**
 * Hosts the prover runtime off the main thread.
 *
 * The runtime is zopro-spr built for the browser: one WebAssembly module
 * that loads a key, builds the witness, proves on a thread pool (and WebGPU
 * where the page has it) and verifies the proof before it returns it. A
 * proof takes seconds, so this is a worker. Every operation is timed here
 * rather than on the page so the reported proving cost excludes postMessage
 * and structured-clone overhead.
 *
 * `threads` greater than zero needs a cross-origin isolated page and starts
 * the Rayon pool. `threads: 0` loads the runtime built without shared memory,
 * which proves on this worker alone and needs no isolation: key files are
 * decompressed across ordinary workers (`key-decoders.ts`) instead.
 */
export {};
