# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, Intel(R) Xeon(R) 6975P-C, 15 GiB, 4 threads, Chrome 157

**Before:** [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) of 2026-11-24. **After:** [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 4.88 s (download: 0.45 s, 6.5 MiB) | 9.74 s (download: 0.39 s, 11.6 MiB) | 14.65 s (download: 0.49 s, 21.6 MiB) | 28.12 s (download: 0.89 s, 41.9 MiB) | 56.20 s (download: 3.09 s, 84.2 MiB) | 88.28 s (download: 3.96 s, 138.6 MiB) | 82.68 s (download: 2.23 s, 133.1 MiB) |
| | after | 5.86 s (download: 2.08 s, 6.5 MiB) (+20 %) | 8.05 s (download: 0.43 s, 11.6 MiB) (-17 %) | 12.38 s (download: 0.58 s, 21.6 MiB) (-15 %) | 23.57 s (download: 0.73 s, 41.9 MiB) (-16 %) | 45.18 s (download: 1.25 s, 84.2 MiB) (-20 %) | 71.96 s (download: 2.10 s, 138.6 MiB) (-18 %) | 69.32 s (download: 2.09 s, 133.1 MiB) (-16 %) |
| warm | before | 0.70 s | 1.31 s | 2.15 s | 3.83 s | 7.25 s | 11.95 s | 11.38 s |
| | after | 0.72 s | 1.46 s (+11 %) | 2.12 s | 3.77 s (-1 %) | 7.08 s (-2 %) | 11.45 s (-4 %) | 11.33 s |
| first run after restart | before | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| | after | 0.95 s (+7 %) | 1.34 s (-5 %) | 2.32 s | 4.06 s (-3 %) | 7.62 s (-3 %) | 12.40 s (-4 %) | 12.18 s (-2 %) |
| repeated after restart | before | 0.74 s | 1.25 s | 2.12 s | 3.77 s | 7.13 s | 11.90 s | 11.43 s |
| | after | 0.78 s | 1.21 s | 2.11 s | 3.74 s | 7.03 s (-1 %) | 11.54 s (-3 %) | 11.22 s (-2 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.03 s | 0.05 s | 0.10 s | 0.17 s | 0.34 s | 0.56 s | 0.52 s |
| | after | 0.03 s | 0.05 s | 0.09 s | 0.16 s | 0.31 s | 0.49 s (-13 %) | 0.47 s (-10 %) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| | after | 0.73 s | 1.19 s (-5 %) | 2.08 s | 3.73 s | 7.01 s (-2 %) | 11.49 s (-3 %) | 11.23 s (-1 %) |

### Proof, last 3 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.73 s | 1.19 s | 2.08 s | 3.73 s | 7.01 s | 11.49 s | 11.23 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 3 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.95 s | 1.34 s | 2.32 s | 4.06 s | 7.62 s | 12.40 s | 12.18 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M1 (Virtual), 7 GiB, 3 threads, Chrome 157

**Before:** [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) of 2026-11-24. **After:** [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 10.26 s (download: 2.52 s, 6.5 MiB) | 21.42 s (download: 10.53 s, 11.6 MiB) | 22.51 s (download: 9.84 s, 21.6 MiB) | 34.10 s (download: 11.36 s, 41.9 MiB) | 58.53 s (download: 10.17 s, 84.2 MiB) | 85.27 s (download: 14.33 s, 138.6 MiB) | 90.73 s (download: 13.50 s, 133.1 MiB) |
| | after | 12.56 s (download: 1.14 s, 6.5 MiB) (+22 %) | 12.41 s (download: 1.14 s, 11.6 MiB) (-42 % **!**) | 23.85 s (download: 1.82 s, 21.6 MiB) (+6 %) | 38.18 s (download: 8.59 s, 41.9 MiB) (+12 %) | 75.75 s (download: 19.16 s, 84.2 MiB) (+29 %) | 100.19 s (download: 16.26 s, 138.6 MiB) (+17 %) | 98.18 s (download: 17.45 s, 133.1 MiB) (+8 %) |
| warm | before | 0.30 s | 0.41 s | 0.65 s | 0.95 s | 1.90 s | 2.57 s | 2.92 s |
| | after | 0.36 s (+21 %) | 1.14 s (+174 % **!**) | 0.63 s | 1.10 s (+16 %) | 1.87 s | 2.71 s (+5 %) | 2.63 s (-10 %) |
| first run after restart | before | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| | after | 11.35 s (+29 %) | failed | 7.73 s (-5 %) | 13.03 s (+51 % **!**) | 11.57 s (+6 %) | 14.91 s (+8 %) | 14.45 s (+35 %) |
| repeated after restart | before | 0.30 s | 0.40 s | 0.66 s | 0.96 s | 1.62 s | 3.41 s | 2.53 s |
| | after | 0.32 s | failed | 0.64 s | 1.30 s (+36 % **!**) | 1.61 s | 3.73 s (+9 %) | 4.33 s (+71 % **!**) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.06 s | 0.09 s | 0.13 s | 0.25 s | 0.82 s | 0.73 s | 1.88 s |
| | after | 0.12 s (+100 % **!**) |  | 0.14 s | 0.37 s (+48 % **!**) | 0.63 s (-23 %) | 1.03 s (+41 % **!**) | 1.34 s (-29 %) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| | after | 0.27 s | 0.97 s (+167 % **!**) | 0.59 s | 1.09 s (+18 %) | 1.90 s (+4 %) | 4.25 s (+36 % **!**) | 3.38 s (+24 %) |

Failed:

- 2 → 2, restart run: Prover worker failed

### Proof, last 3 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.27 s | 0.97 s | 0.59 s | 1.09 s | 1.90 s | 4.25 s | 3.38 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 3 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 11.35 s |  | 7.73 s | 13.03 s | 11.57 s | 14.91 s | 14.45 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
