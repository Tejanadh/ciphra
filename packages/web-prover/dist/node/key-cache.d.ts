import type { KeyCache, KeyCacheStorage } from "../key-store.js";
/** Only public proving keys are persisted. Atomic files prevent partial/concurrent writes. */
export declare class DiskCacheStorage implements KeyCacheStorage {
    #private;
    constructor(directory: string);
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
    open(name: string): Promise<KeyCache>;
}
