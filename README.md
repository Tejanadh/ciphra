# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, AMD EPYC 9V74 80-Core Processor, 16 GiB, 4 threads, Chrome 157

**Before:** [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) of 2026-11-23. **After:** [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 11.31 s (download: 1.54 s, 6.5 MiB) | 19.52 s (download: 0.66 s, 11.6 MiB) | 33.06 s (download: 4.49 s, 21.6 MiB) | 60.58 s (download: 5.79 s, 41.9 MiB) | 115.62 s (download: 8.73 s, 84.2 MiB) | 181.85 s (download: 13.29 s, 138.6 MiB) | 174.72 s (download: 11.62 s, 133.1 MiB) |
| | after | 4.88 s (download: 0.45 s, 6.5 MiB) (-57 % **!**) | 9.74 s (download: 0.39 s, 11.6 MiB) (-50 % **!**) | 14.65 s (download: 0.49 s, 21.6 MiB) (-56 % **!**) | 28.12 s (download: 0.89 s, 41.9 MiB) (-54 % **!**) | 56.20 s (download: 3.09 s, 84.2 MiB) (-51 % **!**) | 88.28 s (download: 3.96 s, 138.6 MiB) (-51 % **!**) | 82.68 s (download: 2.23 s, 133.1 MiB) (-53 % **!**) |
| warm | before | 1.45 s | 2.50 s | 4.37 s | 7.80 s | 14.46 s | 23.51 s | 23.00 s |
| | after | 0.70 s (-51 % **!**) | 1.31 s (-48 % **!**) | 2.15 s (-51 % **!**) | 3.83 s (-51 % **!**) | 7.25 s (-50 % **!**) | 11.95 s (-49 % **!**) | 11.38 s (-51 % **!**) |
| first run after restart | before | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |
| | after | 0.89 s (-44 % **!**) | 1.42 s (-45 % **!**) | 2.35 s (-51 % **!**) | 4.20 s (-49 % **!**) | 7.86 s (-48 % **!**) | 12.89 s (-48 % **!**) | 12.43 s (-49 % **!**) |
| repeated after restart | before | 1.72 s | 2.48 s | 4.26 s | 7.77 s | 14.27 s | 23.73 s | 22.73 s |
| | after | 0.74 s (-57 % **!**) | 1.25 s (-49 % **!**) | 2.12 s (-50 % **!**) | 3.77 s (-51 % **!**) | 7.13 s (-50 % **!**) | 11.90 s (-50 % **!**) | 11.43 s (-50 % **!**) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.04 s | 0.07 s | 0.11 s | 0.21 s | 0.41 s | 0.66 s | 0.61 s |
| | after | 0.03 s | 0.05 s | 0.10 s | 0.17 s | 0.34 s (-17 %) | 0.56 s (-15 %) | 0.52 s (-15 %) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |
| | after | 0.69 s (-51 % **!**) | 1.24 s (-49 % **!**) | 2.10 s (-51 % **!**) | 3.77 s (-51 % **!**) | 7.16 s (-50 % **!**) | 11.86 s (-49 % **!**) | 11.36 s (-51 % **!**) |

### Proof, last 2 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 2 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M1 (Virtual), 7 GiB, 3 threads, Chrome 157

**Before:** [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) of 2026-11-23. **After:** [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) of 2026-11-24.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 6.87 s (download: 5.03 s, 6.5 MiB) | 5.34 s (download: 2.39 s, 11.6 MiB) | 7.76 s (download: 0.54 s, 21.6 MiB) | 13.96 s (download: 0.71 s, 41.9 MiB) | 37.99 s (download: 11.46 s, 84.2 MiB) | 51.26 s (download: 14.06 s, 138.6 MiB) | 51.92 s (download: 14.12 s, 133.1 MiB) |
| | after | 10.26 s (download: 2.52 s, 6.5 MiB) (+49 % **!**) | 21.42 s (download: 10.53 s, 11.6 MiB) (+301 % **!**) | 22.51 s (download: 9.84 s, 21.6 MiB) (+190 % **!**) | 34.10 s (download: 11.36 s, 41.9 MiB) (+144 % **!**) | 58.53 s (download: 10.17 s, 84.2 MiB) (+54 % **!**) | 85.27 s (download: 14.33 s, 138.6 MiB) (+66 % **!**) | 90.73 s (download: 13.50 s, 133.1 MiB) (+75 % **!**) |
| warm | before | 0.13 s | 0.19 s | 0.28 s | 0.39 s | 0.57 s | 1.01 s | 0.92 s |
| | after | 0.30 s (+123 % **!**) | 0.41 s (+116 % **!**) | 0.65 s (+130 % **!**) | 0.95 s (+143 % **!**) | 1.90 s (+231 % **!**) | 2.57 s (+155 % **!**) | 2.92 s (+216 % **!**) |
| first run after restart | before | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
| | after | 8.81 s (+58 % **!**) | 8.82 s (+40 % **!**) | 8.16 s (+38 % **!**) | 8.61 s (+25 %) | 10.88 s (+88 % **!**) | 13.76 s (+84 % **!**) | 10.72 s (+42 % **!**) |
| repeated after restart | before | 0.18 s | 0.21 s | 0.30 s | 0.43 s | 0.59 s | 1.10 s | 1.18 s |
| | after | 0.30 s (+68 % **!**) | 0.40 s (+86 % **!**) | 0.66 s (+120 % **!**) | 0.96 s (+121 % **!**) | 1.62 s (+175 % **!**) | 3.41 s (+210 % **!**) | 2.53 s (+115 % **!**) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.03 s | 0.07 s | 0.11 s | 0.13 s | 0.33 s | 0.60 s | 0.55 s |
| | after | 0.06 s | 0.09 s | 0.13 s | 0.25 s (+92 % **!**) | 0.82 s (+148 % **!**) | 0.73 s (+22 %) | 1.88 s (+242 % **!**) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |
| | after | 0.25 s (+89 % **!**) | 0.36 s (+125 % **!**) | 0.61 s (+130 % **!**) | 0.92 s (+155 % **!**) | 1.82 s (+227 % **!**) | 3.12 s (+204 % **!**) | 2.72 s (+169 % **!**) |

### Proof, last 2 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 2 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
