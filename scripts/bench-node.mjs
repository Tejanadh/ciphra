import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { cpus, platform, arch } from "node:os";
import { SprNodeProver } from "../packages/web-prover/dist/node/index.js";

const shapes = (process.env.SPR_BENCH_SHAPES ?? "2x2,16x2,24x2,merge-24x1").split(",");
const iterations = Number(process.env.SPR_BENCH_RUNS ?? 5);
assert.ok(Number.isInteger(iterations) && iterations > 0);
const modes = (process.env.SPR_BENCH_MODES ?? "cpu:0,cpu:4,cpu:8,gpu:4,gpu:8").split(",").map((mode) => {
  const [backend, count] = mode.split(":");
  const threads = Number(count);
  assert.ok(["cpu", "gpu"].includes(backend) && Number.isInteger(threads) && threads >= 0 && threads <= 64);
  return { threads, gpu: backend === "gpu" ? "required" : "off" };
});
const results = [];
for (const mode of modes) {
  const prover = new SprNodeProver({ proverUrl: "http://127.0.0.1:3001", ...mode });
  try {
    const start = performance.now();
    await prover.start();
    const startupMs = performance.now() - start;
    for (const shape of shapes) {
      const fixture = shape.startsWith("merge-") ? shape : `transfer-${shape}`;
      const body = await readFile(new URL(`../fixtures/${fixture}.json`, import.meta.url), "utf8");
      const firstStart = performance.now();
      const first = await prover.proveRequest(body);
      const firstMs = performance.now() - firstStart;
      const times = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const proof = await prover.proveRequest(body);
        assert.equal(proof.backend, mode.gpu === "required" ? "gpu" : "cpu");
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      const result = { shape, ...mode, backend: first.backend, startupMs, firstMs,
        medianMs: times[Math.floor(times.length / 2)], maxMs: times.at(-1), samplesMs: times };
      results.push(result);
      console.log(JSON.stringify(result));
    }
  } finally { prover.terminate(); }
}
const report = { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, results };
if (process.env.SPR_BENCH_OUTPUT) await writeFile(process.env.SPR_BENCH_OUTPUT, JSON.stringify(report, null, 2) + "\n");
