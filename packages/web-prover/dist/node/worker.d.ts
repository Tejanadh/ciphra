import { type Transferable } from "node:worker_threads";
/** Web Worker message surface backed by a Node thread, including nested Rayon workers. */
export declare class NodeWorker extends EventTarget {
    #private;
    addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
    constructor(url: URL, options?: {
        name?: string;
        gpu?: "auto" | "off" | "required";
    });
    postMessage(message: unknown, transfer?: Transferable[]): void;
    terminate(): void;
}
