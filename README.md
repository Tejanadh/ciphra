# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, AMD EPYC 9V74 80-Core Processor, 8 GiB, 2 threads, Chrome 157

**After:** [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) of 2026-11-23. No report of `main` to compare with yet.

| by scenario | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|
| first run, including download | 11.31 s (download: 1.54 s, 6.5 MiB) | 19.52 s (download: 0.66 s, 11.6 MiB) | 33.06 s (download: 4.49 s, 21.6 MiB) | 60.58 s (download: 5.79 s, 41.9 MiB) | 115.62 s (download: 8.73 s, 84.2 MiB) | 181.85 s (download: 13.29 s, 138.6 MiB) | 174.72 s (download: 11.62 s, 133.1 MiB) |
| warm | 1.45 s | 2.50 s | 4.37 s | 7.80 s | 14.46 s | 23.51 s | 23.00 s |
| first run after restart | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |
| repeated after restart | 1.72 s | 2.48 s | 4.26 s | 7.77 s | 14.27 s | 23.73 s | 22.73 s |

| by stage | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|
| key load | 0.04 s | 0.07 s | 0.11 s | 0.21 s | 0.41 s | 0.66 s | 0.61 s |
| witness | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### Proof, last 1 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 1 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M2 Pro (Virtual), 14 GiB, 5 threads, Chrome 157

**After:** [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) of 2026-11-23. No report of `main` to compare with yet.

| by scenario | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|
| first run, including download | 6.87 s (download: 5.03 s, 6.5 MiB) | 5.34 s (download: 2.39 s, 11.6 MiB) | 7.76 s (download: 0.54 s, 21.6 MiB) | 13.96 s (download: 0.71 s, 41.9 MiB) | 37.99 s (download: 11.46 s, 84.2 MiB) | 51.26 s (download: 14.06 s, 138.6 MiB) | 51.92 s (download: 14.12 s, 133.1 MiB) |
| warm | 0.13 s | 0.19 s | 0.28 s | 0.39 s | 0.57 s | 1.01 s | 0.92 s |
| first run after restart | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
| repeated after restart | 0.18 s | 0.21 s | 0.30 s | 0.43 s | 0.59 s | 1.10 s | 1.18 s |

| by stage | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|
| key load | 0.03 s | 0.07 s | 0.11 s | 0.13 s | 0.33 s | 0.60 s | 0.55 s |
| witness | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### Proof, last 1 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 1 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
