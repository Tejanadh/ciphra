# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, AMD EPYC 9V74 80-Core Processor, 16 GiB, 4 threads, Chrome 157

**Before:** [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) of 2026-11-24. **After:** [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) of 2026-11-27.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 4.22 s (download: 0.35 s, 6.5 MiB) | 7.60 s (download: 0.30 s, 11.6 MiB) | 12.35 s (download: 0.43 s, 21.6 MiB) | 23.86 s (download: 0.80 s, 41.9 MiB) | 45.70 s (download: 1.31 s, 84.2 MiB) | 72.27 s (download: 2.23 s, 138.6 MiB) | 69.92 s (download: 2.23 s, 133.1 MiB) |
| | after | 5.22 s (download: 0.57 s, 6.5 MiB) (+24 %) | 9.10 s (download: 0.41 s, 11.6 MiB) (+20 %) | 16.62 s (download: 2.60 s, 21.6 MiB) (+35 %) | 29.45 s (download: 2.55 s, 41.9 MiB) (+23 %) | 61.46 s (download: 8.55 s, 84.2 MiB) (+34 %) | 85.84 s (download: 2.41 s, 138.6 MiB) (+19 %) | 83.05 s (download: 2.31 s, 133.1 MiB) (+19 %) |
| warm | before | 0.76 s | 1.55 s | 2.16 s | 3.83 s | 7.19 s | 11.77 s | 11.38 s |
| | after | 0.71 s | 1.54 s | 2.11 s | 3.69 s (-4 %) | 7.07 s (-2 %) | 11.45 s (-3 %) | 11.20 s (-2 %) |
| first run after restart | before | 0.85 s | 1.71 s | 2.36 s | 4.19 s | 7.78 s | 12.56 s | 12.23 s |
| | after | 1.04 s (+22 %) | 1.36 s (-20 %) | 2.34 s | 4.15 s | 7.67 s (-1 %) | 12.53 s | 12.05 s (-1 %) |
| repeated after restart | before | 0.79 s | 1.23 s | 2.14 s | 3.86 s | 7.14 s | 11.56 s | 11.24 s |
| | after | 0.72 s (-8 %) | 1.21 s | 2.11 s | 3.76 s (-3 %) | 7.09 s (-1 %) | 11.48 s (-1 %) | 11.14 s (-1 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.03 s | 0.06 s | 0.09 s | 0.16 s | 0.32 s | 0.50 s | 0.47 s |
| | after | 0.04 s | 0.05 s | 0.10 s | 0.17 s | 0.33 s | 0.54 s | 0.54 s (+15 %) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.72 s | 1.42 s | 2.12 s | 3.80 s | 7.13 s | 11.58 s | 11.31 s |
| | after | 0.68 s | 1.34 s (-6 %) | 2.08 s | 3.70 s (-3 %) | 7.03 s (-1 %) | 11.47 s (-1 %) | 11.13 s (-2 %) |

### Proof, last 6 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 0.68 s | 1.34 s | 2.08 s | 3.70 s | 7.03 s | 11.47 s | 11.13 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.72 s | 1.42 s | 2.12 s | 3.80 s | 7.13 s | 11.58 s | 11.31 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.10 s | 1.45 s | 2.67 s | 4.61 s | 8.79 s | 14.25 s | 13.86 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.73 s | 1.19 s | 2.08 s | 3.73 s | 7.01 s | 11.49 s | 11.23 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 6 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 1.04 s | 1.36 s | 2.34 s | 4.15 s | 7.67 s | 12.53 s | 12.05 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.85 s | 1.71 s | 2.36 s | 4.19 s | 7.78 s | 12.56 s | 12.23 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.21 s | 1.67 s | 3.02 s | 5.21 s | 9.66 s | 15.52 s | 15.11 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.95 s | 1.34 s | 2.32 s | 4.06 s | 7.62 s | 12.40 s | 12.18 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M1 (Virtual), 7 GiB, 3 threads, Chrome 157

**Before:** [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) of 2026-11-24. **After:** [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) of 2026-11-27.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 17.49 s (download: 2.19 s, 6.5 MiB) | 24.93 s (download: 12.99 s, 11.6 MiB) | 15.69 s (download: 1.07 s, 21.6 MiB) | 25.29 s (download: 1.49 s, 41.9 MiB) | 58.27 s (download: 9.87 s, 84.2 MiB) | 94.63 s (download: 18.63 s, 138.6 MiB) | 83.53 s (download: 12.75 s, 133.1 MiB) |
| | after | 11.66 s (download: 0.94 s, 6.5 MiB) (-33 %) | 10.81 s (download: 1.09 s, 11.6 MiB) (-57 % **!**) | 25.47 s (download: 7.79 s, 21.6 MiB) (+62 % **!**) | 23.19 s (download: 1.27 s, 41.9 MiB) (-8 %) | 58.77 s (download: 9.03 s, 84.2 MiB) (+1 %) | 114.24 s (download: 18.84 s, 138.6 MiB) (+21 %) | 91.88 s (download: 15.51 s, 133.1 MiB) (+10 %) |
| warm | before | 0.39 s | 0.42 s | 0.65 s | 0.98 s | 1.93 s | 2.92 s | 2.56 s |
| | after | 0.45 s (+14 %) | 0.44 s | 0.68 s | 0.92 s (-6 %) | 1.91 s | 2.96 s | 2.82 s (+10 %) |
| first run after restart | before | 14.43 s | 9.85 s | 8.07 s | 8.54 s | 9.46 s | 17.33 s | 10.22 s |
| | after | 8.84 s (-39 % **!**) | 9.71 s (-1 %) | 9.48 s (+17 %) | 7.44 s (-13 %) | 14.20 s (+50 % **!**) | 17.95 s (+4 %) | 9.42 s (-8 %) |
| repeated after restart | before | 0.56 s | 0.39 s | 0.66 s | 1.14 s | 1.62 s | 3.18 s | 2.45 s |
| | after | 0.30 s (-45 % **!**) | 0.49 s (+27 %) | 0.63 s | 0.91 s (-20 %) | 1.82 s (+13 %) | 3.65 s (+15 %) | 2.54 s (+4 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.08 s | 0.21 s | 0.12 s | 0.24 s | 0.75 s | 1.27 s | 1.32 s |
| | after | 0.06 s | 0.12 s (-43 % **!**) | 0.14 s | 0.21 s | 0.47 s (-37 % **!**) | 0.81 s (-36 % **!**) | 1.56 s (+18 %) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.43 s | 0.37 s | 0.60 s | 1.01 s | 1.75 s | 3.05 s | 2.72 s |
| | after | 0.30 s (-31 %) | 0.40 s | 0.62 s | 0.88 s (-14 %) | 1.84 s (+5 %) | 3.30 s (+8 %) | 2.63 s (-3 %) |

### Proof, last 6 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 0.30 s | 0.40 s | 0.62 s | 0.88 s | 1.84 s | 3.30 s | 2.63 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.43 s | 0.37 s | 0.60 s | 1.01 s | 1.75 s | 3.05 s | 2.72 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 0.28 s | 0.46 s | 0.64 s | 1.12 s | 2.33 s | 3.47 s | 3.67 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.27 s | 0.97 s | 0.59 s | 1.09 s | 1.90 s | 4.25 s | 3.38 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 6 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 8.84 s | 9.71 s | 9.48 s | 7.44 s | 14.20 s | 17.95 s | 9.42 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 14.43 s | 9.85 s | 8.07 s | 8.54 s | 9.46 s | 17.33 s | 10.22 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 11.61 s | 10.84 s | 11.70 s | 11.40 s | 15.29 s | 24.38 s | 17.34 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 11.35 s |  | 7.73 s | 13.03 s | 11.57 s | 14.91 s | 14.45 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
