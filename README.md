# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, Intel(R) Xeon(R) 6975P-C, 15 GiB, 4 threads, Chrome 157

**Before:** [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) of 2026-11-24. **After:** [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 6.56 s (download: 0.56 s, 6.5 MiB) | 11.07 s (download: 0.40 s, 11.6 MiB) | 18.63 s (download: 0.60 s, 21.6 MiB) | 35.55 s (download: 1.06 s, 41.9 MiB) | 69.52 s (download: 1.90 s, 84.2 MiB) | 110.55 s (download: 2.90 s, 138.6 MiB) | 106.80 s (download: 3.05 s, 133.1 MiB) |
| | after | 4.22 s (download: 0.35 s, 6.5 MiB) (-36 % **!**) | 7.60 s (download: 0.30 s, 11.6 MiB) (-31 %) | 12.35 s (download: 0.43 s, 21.6 MiB) (-34 %) | 23.86 s (download: 0.80 s, 41.9 MiB) (-33 %) | 45.70 s (download: 1.31 s, 84.2 MiB) (-34 %) | 72.27 s (download: 2.23 s, 138.6 MiB) (-35 %) | 69.92 s (download: 2.23 s, 133.1 MiB) (-35 %) |
| warm | before | 1.23 s | 1.50 s | 2.72 s | 4.68 s | 8.81 s | 14.29 s | 14.03 s |
| | after | 0.76 s (-38 % **!**) | 1.55 s | 2.16 s (-21 %) | 3.83 s (-18 %) | 7.19 s (-18 %) | 11.77 s (-18 %) | 11.38 s (-19 %) |
| first run after restart | before | 1.21 s | 1.67 s | 3.02 s | 5.21 s | 9.66 s | 15.52 s | 15.11 s |
| | after | 0.85 s (-30 %) | 1.71 s | 2.36 s (-22 %) | 4.19 s (-20 %) | 7.78 s (-19 %) | 12.56 s (-19 %) | 12.23 s (-19 %) |
| repeated after restart | before | 1.16 s | 1.52 s | 2.72 s | 4.63 s | 8.90 s | 14.31 s | 13.92 s |
| | after | 0.79 s (-32 %) | 1.23 s (-19 %) | 2.14 s (-21 %) | 3.86 s (-17 %) | 7.14 s (-20 %) | 11.56 s (-19 %) | 11.24 s (-19 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.06 s | 0.07 s | 0.14 s | 0.22 s | 0.42 s | 0.67 s | 0.68 s |
| | after | 0.03 s | 0.06 s | 0.09 s (-36 % **!**) | 0.16 s (-27 %) | 0.32 s (-24 %) | 0.50 s (-25 %) | 0.47 s (-31 %) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 1.10 s | 1.45 s | 2.67 s | 4.61 s | 8.79 s | 14.25 s | 13.86 s |
| | after | 0.72 s (-34 %) | 1.42 s | 2.12 s (-21 %) | 3.80 s (-18 %) | 7.13 s (-19 %) | 11.58 s (-19 %) | 11.31 s (-18 %) |

### Proof, last 5 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.72 s | 1.42 s | 2.12 s | 3.80 s | 7.13 s | 11.58 s | 11.31 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.10 s | 1.45 s | 2.67 s | 4.61 s | 8.79 s | 14.25 s | 13.86 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.73 s | 1.19 s | 2.08 s | 3.73 s | 7.01 s | 11.49 s | 11.23 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 5 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.85 s | 1.71 s | 2.36 s | 4.19 s | 7.78 s | 12.56 s | 12.23 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.21 s | 1.67 s | 3.02 s | 5.21 s | 9.66 s | 15.52 s | 15.11 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.95 s | 1.34 s | 2.32 s | 4.06 s | 7.62 s | 12.40 s | 12.18 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M1 (Virtual), 7 GiB, 3 threads, Chrome 157

**Before:** [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) of 2026-11-24. **After:** [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 17.31 s (download: 1.56 s, 6.5 MiB) | 24.49 s (download: 10.56 s, 11.6 MiB) | 28.30 s (download: 11.89 s, 21.6 MiB) | 44.90 s (download: 11.37 s, 41.9 MiB) | 86.61 s (download: 18.29 s, 84.2 MiB) | 117.56 s (download: 20.47 s, 138.6 MiB) | 110.92 s (download: 21.31 s, 133.1 MiB) |
| | after | 17.49 s (download: 2.19 s, 6.5 MiB) (+1 %) | 24.93 s (download: 12.99 s, 11.6 MiB) (+2 %) | 15.69 s (download: 1.07 s, 21.6 MiB) (-45 % **!**) | 25.29 s (download: 1.49 s, 41.9 MiB) (-44 % **!**) | 58.27 s (download: 9.87 s, 84.2 MiB) (-33 %) | 94.63 s (download: 18.63 s, 138.6 MiB) (-20 %) | 83.53 s (download: 12.75 s, 133.1 MiB) (-25 %) |
| warm | before | 0.33 s | 0.49 s | 0.70 s | 1.08 s | 1.99 s | 3.23 s | 3.01 s |
| | after | 0.39 s (+21 %) | 0.42 s (-14 %) | 0.65 s | 0.98 s (-9 %) | 1.93 s (-3 %) | 2.92 s (-10 %) | 2.56 s (-15 %) |
| first run after restart | before | 11.61 s | 10.84 s | 11.70 s | 11.40 s | 15.29 s | 24.38 s | 17.34 s |
| | after | 14.43 s (+24 %) | 9.85 s (-9 %) | 8.07 s (-31 %) | 8.54 s (-25 %) | 9.46 s (-38 % **!**) | 17.33 s (-29 %) | 10.22 s (-41 % **!**) |
| repeated after restart | before | 0.36 s | 0.55 s | 0.73 s | 1.17 s | 2.15 s | 3.76 s | 4.10 s |
| | after | 0.56 s (+52 % **!**) | 0.39 s (-29 %) | 0.66 s (-10 %) | 1.14 s | 1.62 s (-25 %) | 3.18 s (-15 %) | 2.45 s (-40 % **!**) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.07 s | 0.12 s | 0.16 s | 0.35 s | 0.56 s | 2.64 s | 1.35 s |
| | after | 0.08 s | 0.21 s (+75 % **!**) | 0.12 s | 0.24 s (-31 %) | 0.75 s (+34 %) | 1.27 s (-52 % **!**) | 1.32 s |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.28 s | 0.46 s | 0.64 s | 1.12 s | 2.33 s | 3.47 s | 3.67 s |
| | after | 0.43 s (+52 % **!**) | 0.37 s (-19 %) | 0.60 s | 1.01 s (-10 %) | 1.75 s (-25 %) | 3.05 s (-12 %) | 2.72 s (-26 %) |

### Proof, last 5 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.43 s | 0.37 s | 0.60 s | 1.01 s | 1.75 s | 3.05 s | 2.72 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 0.28 s | 0.46 s | 0.64 s | 1.12 s | 2.33 s | 3.47 s | 3.67 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.27 s | 0.97 s | 0.59 s | 1.09 s | 1.90 s | 4.25 s | 3.38 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 5 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 14.43 s | 9.85 s | 8.07 s | 8.54 s | 9.46 s | 17.33 s | 10.22 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 11.61 s | 10.84 s | 11.70 s | 11.40 s | 15.29 s | 24.38 s | 17.34 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 11.35 s |  | 7.73 s | 13.03 s | 11.57 s | 14.91 s | 14.45 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
