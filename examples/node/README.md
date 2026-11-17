# Node prover

Node 24+ runs the TypeScript example directly, without a bundler. From the repository root:

```sh
npm ci
npm run build:prover
node examples/node/prove.ts
```

The example preloads the 2→2 proving key, proves a synthetic request and prints
its proof and elapsed time. No wallet, RPC or prover server is needed. First
use downloads the public key; later runs reuse `~/.cache/spr-prover`.

`gpu: "auto"` uses Dawn WebGPU when available and CPU otherwise. Outside this
workspace, install `@heliuslabs/spr-web-prover` and optionally `webgpu`.
The 512 MiB resident-key budget enables caching across shapes; it is an estimate
of key state, not a hard process memory limit. Omit it to keep one loaded shape.
