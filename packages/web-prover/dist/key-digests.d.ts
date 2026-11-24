/** The pinned key set's version folder on the proving-keys CDN. */
export declare const KEY_SET = "78751f5d1c591777";
/** Where the pinned key set is served from; the default `keyBaseUrl`. */
export declare const KEY_BASE_URL = "https://d3gbdb0egjwcw9.cloudfront.net/proving-keys/78751f5d1c591777/";
/**
 * Every proving key the browser prover can load, by the gnark key's name: its
 * zopro key file, that file's size and sha256, and the sha256 of the gnark key
 * it was built from, which proofs report.
 */
export declare const KEY_DIGESTS: Readonly<Record<string, Readonly<{
    file: string;
    size: number;
    sha256: string;
    keySha256: string;
}>>>;
