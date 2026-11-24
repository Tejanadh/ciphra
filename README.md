# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, AMD EPYC 9V74 80-Core Processor, 16 GiB, 4 threads, Chrome 157

**Before:** [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) of 2026-11-24. **After:** [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 5.86 s (download: 2.08 s, 6.5 MiB) | 8.05 s (download: 0.43 s, 11.6 MiB) | 12.38 s (download: 0.58 s, 21.6 MiB) | 23.57 s (download: 0.73 s, 41.9 MiB) | 45.18 s (download: 1.25 s, 84.2 MiB) | 71.96 s (download: 2.10 s, 138.6 MiB) | 69.32 s (download: 2.09 s, 133.1 MiB) |
| | after | 6.56 s (download: 0.56 s, 6.5 MiB) (+12 %) | 11.07 s (download: 0.40 s, 11.6 MiB) (+37 % **!**) | 18.63 s (download: 0.60 s, 21.6 MiB) (+50 % **!**) | 35.55 s (download: 1.06 s, 41.9 MiB) (+51 % **!**) | 69.52 s (download: 1.90 s, 84.2 MiB) (+54 % **!**) | 110.55 s (download: 2.90 s, 138.6 MiB) (+54 % **!**) | 106.80 s (download: 3.05 s, 133.1 MiB) (+54 % **!**) |
| warm | before | 0.72 s | 1.46 s | 2.12 s | 3.77 s | 7.08 s | 11.45 s | 11.33 s |
| | after | 1.23 s (+69 % **!**) | 1.50 s | 2.72 s (+29 %) | 4.68 s (+24 %) | 8.81 s (+25 %) | 14.29 s (+25 %) | 14.03 s (+24 %) |
| first run after restart | before | 0.95 s | 1.34 s | 2.32 s | 4.06 s | 7.62 s | 12.40 s | 12.18 s |
| | after | 1.21 s (+27 %) | 1.67 s (+24 %) | 3.02 s (+31 %) | 5.21 s (+28 %) | 9.66 s (+27 %) | 15.52 s (+25 %) | 15.11 s (+24 %) |
| repeated after restart | before | 0.78 s | 1.21 s | 2.11 s | 3.74 s | 7.03 s | 11.54 s | 11.22 s |
| | after | 1.16 s (+48 % **!**) | 1.52 s (+26 %) | 2.72 s (+29 %) | 4.63 s (+24 %) | 8.90 s (+27 %) | 14.31 s (+24 %) | 13.92 s (+24 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.03 s | 0.05 s | 0.09 s | 0.16 s | 0.31 s | 0.49 s | 0.47 s |
| | after | 0.06 s | 0.07 s | 0.14 s (+56 % **!**) | 0.22 s (+38 % **!**) | 0.42 s (+35 % **!**) | 0.67 s (+37 % **!**) | 0.68 s (+45 % **!**) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.73 s | 1.19 s | 2.08 s | 3.73 s | 7.01 s | 11.49 s | 11.23 s |
| | after | 1.10 s (+50 % **!**) | 1.45 s (+22 %) | 2.67 s (+29 %) | 4.61 s (+24 %) | 8.79 s (+25 %) | 14.25 s (+24 %) | 13.86 s (+23 %) |

### Proof, last 4 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.10 s | 1.45 s | 2.67 s | 4.61 s | 8.79 s | 14.25 s | 13.86 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.73 s | 1.19 s | 2.08 s | 3.73 s | 7.01 s | 11.49 s | 11.23 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 4 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.21 s | 1.67 s | 3.02 s | 5.21 s | 9.66 s | 15.52 s | 15.11 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.95 s | 1.34 s | 2.32 s | 4.06 s | 7.62 s | 12.40 s | 12.18 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M1 (Virtual), 7 GiB, 3 threads, Chrome 157

**Before:** [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) of 2026-11-24. **After:** [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 12.56 s (download: 1.14 s, 6.5 MiB) | 12.41 s (download: 1.14 s, 11.6 MiB) | 23.85 s (download: 1.82 s, 21.6 MiB) | 38.18 s (download: 8.59 s, 41.9 MiB) | 75.75 s (download: 19.16 s, 84.2 MiB) | 100.19 s (download: 16.26 s, 138.6 MiB) | 98.18 s (download: 17.45 s, 133.1 MiB) |
| | after | 17.31 s (download: 1.56 s, 6.5 MiB) (+38 % **!**) | 24.49 s (download: 10.56 s, 11.6 MiB) (+97 % **!**) | 28.30 s (download: 11.89 s, 21.6 MiB) (+19 %) | 44.90 s (download: 11.37 s, 41.9 MiB) (+18 %) | 86.61 s (download: 18.29 s, 84.2 MiB) (+14 %) | 117.56 s (download: 20.47 s, 138.6 MiB) (+17 %) | 110.92 s (download: 21.31 s, 133.1 MiB) (+13 %) |
| warm | before | 0.36 s | 1.14 s | 0.63 s | 1.10 s | 1.87 s | 2.71 s | 2.63 s |
| | after | 0.33 s | 0.49 s (-57 % **!**) | 0.70 s (+11 %) | 1.08 s | 1.99 s (+6 %) | 3.23 s (+19 %) | 3.01 s (+15 %) |
| first run after restart | before | 11.35 s | failed | 7.73 s | 13.03 s | 11.57 s | 14.91 s | 14.45 s |
| | after | 11.61 s (+2 %) | 10.84 s | 11.70 s (+51 % **!**) | 11.40 s (-13 %) | 15.29 s (+32 %) | 24.38 s (+63 % **!**) | 17.34 s (+20 %) |
| repeated after restart | before | 0.32 s | failed | 0.64 s | 1.30 s | 1.61 s | 3.73 s | 4.33 s |
| | after | 0.36 s (+16 %) | 0.55 s | 0.73 s (+15 %) | 1.17 s (-10 %) | 2.15 s (+33 %) | 3.76 s | 4.10 s (-5 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.12 s |  | 0.14 s | 0.37 s | 0.63 s | 1.03 s | 1.34 s |
| | after | 0.07 s (-42 % **!**) | 0.12 s | 0.16 s | 0.35 s | 0.56 s (-11 %) | 2.64 s (+156 % **!**) | 1.35 s |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.27 s | 0.97 s | 0.59 s | 1.09 s | 1.90 s | 4.25 s | 3.38 s |
| | after | 0.28 s | 0.46 s (-53 % **!**) | 0.64 s (+9 %) | 1.12 s | 2.33 s (+22 %) | 3.47 s (-18 %) | 3.67 s (+9 %) |

### Proof, last 4 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 0.28 s | 0.46 s | 0.64 s | 1.12 s | 2.33 s | 3.47 s | 3.67 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.27 s | 0.97 s | 0.59 s | 1.09 s | 1.90 s | 4.25 s | 3.38 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 4 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 11.61 s | 10.84 s | 11.70 s | 11.40 s | 15.29 s | 24.38 s | 17.34 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 11.35 s |  | 7.73 s | 13.03 s | 11.57 s | 14.91 s | 14.45 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
