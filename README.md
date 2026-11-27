# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, AMD EPYC 7763 64-Core Processor, 16 GiB, 4 threads, Chrome 157

**Before:** [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) of 2026-11-27. **After:** [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) of 2026-11-27.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 5.22 s (download: 0.57 s, 6.5 MiB) | 9.10 s (download: 0.41 s, 11.6 MiB) | 16.62 s (download: 2.60 s, 21.6 MiB) | 29.45 s (download: 2.55 s, 41.9 MiB) | 61.46 s (download: 8.55 s, 84.2 MiB) | 85.84 s (download: 2.41 s, 138.6 MiB) | 83.05 s (download: 2.31 s, 133.1 MiB) |
| | after | 5.84 s (download: 0.54 s, 6.5 MiB) (+12 %) | 11.78 s (download: 0.43 s, 11.6 MiB) (+30 %) | 17.46 s (download: 0.59 s, 21.6 MiB) (+5 %) | 33.32 s (download: 1.07 s, 41.9 MiB) (+13 %) | 65.53 s (download: 1.97 s, 84.2 MiB) (+7 %) | 103.91 s (download: 3.16 s, 138.6 MiB) (+21 %) | 99.72 s (download: 2.85 s, 133.1 MiB) (+20 %) |
| warm | before | 0.71 s | 1.54 s | 2.11 s | 3.69 s | 7.07 s | 11.45 s | 11.20 s |
| | after | 0.95 s (+34 %) | 1.83 s (+19 %) | 2.94 s (+39 % **!**) | 4.97 s (+35 %) | 9.63 s (+36 % **!**) | 15.43 s (+35 %) | 15.35 s (+37 % **!**) |
| first run after restart | before | 1.04 s | 1.36 s | 2.34 s | 4.15 s | 7.67 s | 12.53 s | 12.05 s |
| | after | 1.13 s (+9 %) | 1.79 s (+31 %) | 3.19 s (+36 % **!**) | 5.49 s (+32 %) | 10.39 s (+35 % **!**) | 16.66 s (+33 %) | 16.04 s (+33 %) |
| repeated after restart | before | 0.72 s | 1.21 s | 2.11 s | 3.76 s | 7.09 s | 11.48 s | 11.14 s |
| | after | 1.30 s (+80 % **!**) | 1.59 s (+31 %) | 2.85 s (+35 % **!**) | 4.97 s (+32 %) | 9.44 s (+33 %) | 15.31 s (+33 %) | 14.80 s (+33 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.04 s | 0.05 s | 0.10 s | 0.17 s | 0.33 s | 0.54 s | 0.54 s |
| | after | 0.05 s | 0.07 s | 0.13 s | 0.21 s | 0.43 s (+30 %) | 0.67 s (+24 %) | 0.64 s (+19 %) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.68 s | 1.34 s | 2.08 s | 3.70 s | 7.03 s | 11.47 s | 11.13 s |
| | after | 0.94 s (+39 % **!**) | 1.57 s (+17 %) | 2.83 s (+37 % **!**) | 4.92 s (+33 %) | 9.52 s (+35 % **!**) | 15.34 s (+34 %) | 14.84 s (+33 %) |

### Proof, last 7 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 0.94 s | 1.57 s | 2.83 s | 4.92 s | 9.52 s | 15.34 s | 14.84 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 0.68 s | 1.34 s | 2.08 s | 3.70 s | 7.03 s | 11.47 s | 11.13 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.72 s | 1.42 s | 2.12 s | 3.80 s | 7.13 s | 11.58 s | 11.31 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.10 s | 1.45 s | 2.67 s | 4.61 s | 8.79 s | 14.25 s | 13.86 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.73 s | 1.19 s | 2.08 s | 3.73 s | 7.01 s | 11.49 s | 11.23 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 7 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 1.13 s | 1.79 s | 3.19 s | 5.49 s | 10.39 s | 16.66 s | 16.04 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 1.04 s | 1.36 s | 2.34 s | 4.15 s | 7.67 s | 12.53 s | 12.05 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.85 s | 1.71 s | 2.36 s | 4.19 s | 7.78 s | 12.56 s | 12.23 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.21 s | 1.67 s | 3.02 s | 5.21 s | 9.66 s | 15.52 s | 15.11 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.95 s | 1.34 s | 2.32 s | 4.06 s | 7.62 s | 12.40 s | 12.18 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M1 (Virtual), 7 GiB, 3 threads, Chrome 158

**Before:** [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) of 2026-11-27. **After:** [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) of 2026-11-27.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 11.66 s (download: 0.94 s, 6.5 MiB) | 10.81 s (download: 1.09 s, 11.6 MiB) | 25.47 s (download: 7.79 s, 21.6 MiB) | 23.19 s (download: 1.27 s, 41.9 MiB) | 58.77 s (download: 9.03 s, 84.2 MiB) | 114.24 s (download: 18.84 s, 138.6 MiB) | 91.88 s (download: 15.51 s, 133.1 MiB) |
| | after | 13.21 s (download: 1.62 s, 6.5 MiB) (+13 %) | 7.38 s (download: 0.74 s, 11.6 MiB) (-32 %) | 11.90 s (download: 0.74 s, 21.6 MiB) (-53 % **!**) | 30.06 s (download: 7.02 s, 41.9 MiB) (+30 %) | 77.02 s (download: 15.15 s, 84.2 MiB) (+31 %) | 129.25 s (download: 25.54 s, 138.6 MiB) (+13 %) | 103.46 s (download: 19.05 s, 133.1 MiB) (+13 %) |
| warm | before | 0.45 s | 0.44 s | 0.68 s | 0.92 s | 1.91 s | 2.96 s | 2.82 s |
| | after | 0.31 s (-31 %) | 0.37 s (-16 %) | 0.62 s (-8 %) | 0.92 s | 1.73 s (-9 %) | 3.79 s (+28 %) | 2.62 s (-7 %) |
| first run after restart | before | 8.84 s | 9.71 s | 9.48 s | 7.44 s | 14.20 s | 17.95 s | 9.42 s |
| | after | 6.90 s (-22 %) | 6.14 s (-37 % **!**) | 7.57 s (-20 %) | 7.89 s (+6 %) | 9.16 s (-36 % **!**) | 19.43 s (+8 %) | 17.07 s (+81 % **!**) |
| repeated after restart | before | 0.30 s | 0.49 s | 0.63 s | 0.91 s | 1.82 s | 3.65 s | 2.54 s |
| | after | 0.29 s | 0.38 s (-23 %) | 0.62 s | 0.98 s (+7 %) | 1.52 s (-16 %) | 4.01 s (+10 %) | 3.68 s (+45 % **!**) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.06 s | 0.12 s | 0.14 s | 0.21 s | 0.47 s | 0.81 s | 1.56 s |
| | after | 0.11 s (+83 % **!**) | 0.07 s (-42 % **!**) | 0.11 s | 0.19 s | 0.57 s (+21 %) | 1.40 s (+73 % **!**) | 0.99 s (-37 % **!**) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.30 s | 0.40 s | 0.62 s | 0.88 s | 1.84 s | 3.30 s | 2.63 s |
| | after | 0.24 s (-20 %) | 0.34 s (-17 %) | 0.59 s | 0.91 s | 1.62 s (-12 %) | 4.96 s (+50 % **!**) | 3.26 s (+24 %) |

### Proof, last 7 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 0.24 s | 0.34 s | 0.59 s | 0.91 s | 1.62 s | 4.96 s | 3.26 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 0.30 s | 0.40 s | 0.62 s | 0.88 s | 1.84 s | 3.30 s | 2.63 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.43 s | 0.37 s | 0.60 s | 1.01 s | 1.75 s | 3.05 s | 2.72 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 0.28 s | 0.46 s | 0.64 s | 1.12 s | 2.33 s | 3.47 s | 3.67 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.27 s | 0.97 s | 0.59 s | 1.09 s | 1.90 s | 4.25 s | 3.38 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 7 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 6.90 s | 6.14 s | 7.57 s | 7.89 s | 9.16 s | 19.43 s | 17.07 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 8.84 s | 9.71 s | 9.48 s | 7.44 s | 14.20 s | 17.95 s | 9.42 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 14.43 s | 9.85 s | 8.07 s | 8.54 s | 9.46 s | 17.33 s | 10.22 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 11.61 s | 10.84 s | 11.70 s | 11.40 s | 15.29 s | 24.38 s | 17.34 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 11.35 s |  | 7.73 s | 13.03 s | 11.57 s | 14.91 s | 14.45 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
