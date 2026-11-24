/** The public /proving-keys download catalog, independent of proof routing. */
export interface ProvingKeyCatalog {
    readonly keys: readonly Readonly<{
        name: string;
        artifacts: readonly Readonly<{
            format: "gnark" | "zopro";
            sha256: string;
            size: number;
            url: string;
        }>[];
    }>[];
}
/** Trusted release metadata, for example the protocol SDK's attested key set. */
export interface ProvingKeySource {
    readonly cacheKey: string;
    key(name: string): Readonly<{
        file: string;
        size: number;
        sha256: string;
        keySha256: string;
        url: string;
    }>;
}
/** Snapshot the source once so a proof never mixes releases. */
export declare function sourceKeys(source: ProvingKeySource): Readonly<{
    cacheKey: string;
    keys: ReadonlyMap<string, ReturnType<ProvingKeySource["key"]>>;
}>;
/** Select URLs only for conversions whose bytes and source key we already pin. */
export declare function catalogKeyUrls(catalog: unknown): ReadonlyMap<string, string>;
