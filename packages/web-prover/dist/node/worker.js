import { Worker as Thread } from "node:worker_threads";
/** Web Worker message surface backed by a Node thread, including nested Rayon workers. */
export class NodeWorker extends EventTarget {
    #thread;
    #stopped = false;
    addEventListener(type, listener, options) {
        super.addEventListener(type, listener, options);
    }
    constructor(url, options) {
        super();
        this.#thread = new Thread(new URL("./worker-bootstrap.js", import.meta.url), {
            workerData: { url: url.href, gpu: options?.gpu ?? "off" },
            ...(options?.name === undefined ? {} : { name: options.name }),
            // A parent launched with --input-type would otherwise break file workers.
            execArgv: process.execArgv.filter((arg, index, args) => arg !== "--input-type" && !arg.startsWith("--input-type=") && args[index - 1] !== "--input-type"),
        });
        this.#thread.on("message", (data) => this.dispatchEvent(new MessageEvent("message", { data })));
        this.#thread.on("messageerror", () => this.dispatchEvent(new Event("messageerror")));
        this.#thread.on("error", () => this.dispatchEvent(new Event("error", { cancelable: true })));
        this.#thread.on("exit", () => {
            if (!this.#stopped)
                this.dispatchEvent(new Event("error", { cancelable: true }));
        });
    }
    postMessage(message, transfer = []) {
        this.#thread.postMessage(message, transfer);
    }
    terminate() {
        this.#stopped = true;
        void this.#thread.terminate();
    }
}
