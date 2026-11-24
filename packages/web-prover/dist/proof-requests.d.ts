import { type ShapeKey } from "./shapes.js";
/**
 * A request to the prover's `/prove`. A proof goes to its proving key's own
 * `/prove/<key>`, `<key>` being the key file name without `.key`, or, on the
 * Helius gateway, which routes only the key-less path, to the bare `/prove`
 * with the key named in the body. Every other path below `/prove`, such as
 * `/prove/<key>/indexed` or `/prove/<key>/status`, is `unsupported`: it can
 * carry a witness too, so it is never forwarded.
 */
export type ProveRoute = Readonly<{
    kind: "prove";
    keyFile?: string;
}> | Readonly<{
    kind: "unsupported";
}>;
/** How `url` addresses the prover at `proverUrl`; undefined if it is not a proving route. */
export declare function proveRoute(url: URL, proverUrl: string): ProveRoute | undefined;
/** Observe only public circuit metadata; never retain the witness body. */
export declare function observeProofRequests(fetch: typeof globalThis.fetch, proverUrl: string, onShape: (shape: ShapeKey) => void): typeof globalThis.fetch;
/** Whether `body` is a merge of more notes than the browser proves. */
export declare function isWideMerge(body: string): boolean;
export declare function proofRequestShape(body: string): ShapeKey | undefined;
