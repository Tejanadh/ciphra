# Proof timing on main

Written by CI after every push to `main` (`scripts/proof-timing-history.mjs` on `main`), from headless Chrome on each CI runner. Runner numbers compare commits, not laptops: up to about 30 % between two commits can be the runner. The data is in `history/`, a line per commit.

## Linux x64, AMD EPYC 7763 64-Core Processor, 16 GiB, 4 threads, Chrome 157

**Before:** [`f48f358`](https://github.com/Tejanadh/ciphra/commit/f48f358fd33e942784042ab2fa0f483de7edbe62) of 2026-11-27. **After:** [`26b47a7`](https://github.com/Tejanadh/ciphra/commit/26b47a74f0c30b0d41ea006a3045f299ea8a918d) of 2026-11-27.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 4.10 s (download: 0.28 s, 6.5 MiB) | 7.68 s (download: 0.29 s, 11.6 MiB) | 15.13 s (download: 3.24 s, 21.6 MiB) | 27.30 s (download: 4.22 s, 41.9 MiB) | 51.21 s (download: 6.42 s, 84.2 MiB) | 81.79 s (download: 11.21 s, 138.6 MiB) | 76.67 s (download: 8.72 s, 133.1 MiB) |
| | after | 5.96 s (download: 0.59 s, 6.5 MiB) (+45 % **!**) | 12.00 s (download: 0.45 s, 11.6 MiB) (+56 % **!**) | 17.22 s (download: 0.62 s, 21.6 MiB) (+14 %) | 33.48 s (download: 1.04 s, 41.9 MiB) (+23 %) | 64.62 s (download: 1.92 s, 84.2 MiB) (+26 %) | 102.06 s (download: 2.82 s, 138.6 MiB) (+25 %) | 98.50 s (download: 2.68 s, 133.1 MiB) (+28 %) |
| warm | before | 0.72 s | 1.51 s | 2.16 s | 3.86 s | 7.27 s | 11.79 s | 11.31 s |
| | after | 0.94 s (+30 %) | 2.01 s (+33 %) | 2.93 s (+36 % **!**) | 4.89 s (+27 %) | 9.15 s (+26 %) | 14.68 s (+25 %) | 14.46 s (+28 %) |
| first run after restart | before | 0.82 s | 1.68 s | 2.38 s | 4.24 s | 7.85 s | 12.54 s | 12.15 s |
| | after | 1.14 s (+39 % **!**) | 1.73 s | 3.14 s (+32 %) | 5.41 s (+28 %) | 9.86 s (+26 %) | 16.27 s (+30 %) | 16.03 s (+32 %) |
| repeated after restart | before | 0.74 s | 1.25 s | 2.17 s | 3.86 s | 7.22 s | 11.60 s | 11.37 s |
| | after | 0.96 s (+30 %) | 1.55 s (+25 %) | 2.81 s (+29 %) | 4.92 s (+27 %) | 9.02 s (+25 %) | 15.18 s (+31 %) | 14.54 s (+28 %) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.03 s | 0.05 s | 0.09 s | 0.17 s | 0.32 s | 0.50 s | 0.47 s |
| | after | 0.05 s | 0.07 s | 0.13 s | 0.21 s | 0.42 s (+31 %) | 0.69 s (+38 % **!**) | 0.72 s (+53 % **!**) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.69 s | 1.41 s | 2.13 s | 3.82 s | 7.20 s | 11.65 s | 11.30 s |
| | after | 0.90 s (+31 %) | 1.50 s (+7 %) | 2.79 s (+31 %) | 4.86 s (+27 %) | 9.06 s (+26 %) | 14.89 s (+28 %) | 14.51 s (+28 %) |

### Proof, last 9 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`26b47a7`](https://github.com/Tejanadh/ciphra/commit/26b47a74f0c30b0d41ea006a3045f299ea8a918d) | 2026-11-27 | 0.90 s | 1.50 s | 2.79 s | 4.86 s | 9.06 s | 14.89 s | 14.51 s |
| [`f48f358`](https://github.com/Tejanadh/ciphra/commit/f48f358fd33e942784042ab2fa0f483de7edbe62) | 2026-11-27 | 0.69 s | 1.41 s | 2.13 s | 3.82 s | 7.20 s | 11.65 s | 11.30 s |
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 0.94 s | 1.57 s | 2.83 s | 4.92 s | 9.52 s | 15.34 s | 14.84 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 0.68 s | 1.34 s | 2.08 s | 3.70 s | 7.03 s | 11.47 s | 11.13 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.72 s | 1.42 s | 2.12 s | 3.80 s | 7.13 s | 11.58 s | 11.31 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.10 s | 1.45 s | 2.67 s | 4.61 s | 8.79 s | 14.25 s | 13.86 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.73 s | 1.19 s | 2.08 s | 3.73 s | 7.01 s | 11.49 s | 11.23 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.69 s | 1.24 s | 2.10 s | 3.77 s | 7.16 s | 11.86 s | 11.36 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.40 s | 2.44 s | 4.31 s | 7.74 s | 14.40 s | 23.40 s | 22.99 s |

### First run after a restart, last 9 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`26b47a7`](https://github.com/Tejanadh/ciphra/commit/26b47a74f0c30b0d41ea006a3045f299ea8a918d) | 2026-11-27 | 1.14 s | 1.73 s | 3.14 s | 5.41 s | 9.86 s | 16.27 s | 16.03 s |
| [`f48f358`](https://github.com/Tejanadh/ciphra/commit/f48f358fd33e942784042ab2fa0f483de7edbe62) | 2026-11-27 | 0.82 s | 1.68 s | 2.38 s | 4.24 s | 7.85 s | 12.54 s | 12.15 s |
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 1.13 s | 1.79 s | 3.19 s | 5.49 s | 10.39 s | 16.66 s | 16.04 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 1.04 s | 1.36 s | 2.34 s | 4.15 s | 7.67 s | 12.53 s | 12.05 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.85 s | 1.71 s | 2.36 s | 4.19 s | 7.78 s | 12.56 s | 12.23 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 1.21 s | 1.67 s | 3.02 s | 5.21 s | 9.66 s | 15.52 s | 15.11 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.95 s | 1.34 s | 2.32 s | 4.06 s | 7.62 s | 12.40 s | 12.18 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.89 s | 1.42 s | 2.35 s | 4.20 s | 7.86 s | 12.89 s | 12.43 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 1.58 s | 2.58 s | 4.82 s | 8.23 s | 15.19 s | 24.56 s | 24.20 s |

## macOS arm64, Apple M1 (Virtual), 7 GiB, 3 threads, Chrome 157

**Before:** [`f48f358`](https://github.com/Tejanadh/ciphra/commit/f48f358fd33e942784042ab2fa0f483de7edbe62) of 2026-11-27. **After:** [`26b47a7`](https://github.com/Tejanadh/ciphra/commit/26b47a74f0c30b0d41ea006a3045f299ea8a918d) of 2026-11-27.

| by scenario | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| first run, including download | before | 9.56 s (download: 0.98 s, 6.5 MiB) | 6.62 s (download: 2.82 s, 11.6 MiB) | 8.58 s (download: 0.66 s, 21.6 MiB) | 13.23 s (download: 1.09 s, 41.9 MiB) | 31.28 s (download: 5.79 s, 84.2 MiB) | 41.79 s (download: 6.89 s, 138.6 MiB) | 43.11 s (download: 6.81 s, 133.1 MiB) |
| | after | 12.29 s (download: 1.92 s, 6.5 MiB) (+29 %) | 16.12 s (download: 6.73 s, 11.6 MiB) (+143 % **!**) | 20.79 s (download: 7.33 s, 21.6 MiB) (+142 % **!**) | 34.99 s (download: 7.92 s, 41.9 MiB) (+164 % **!**) | 60.91 s (download: 13.33 s, 84.2 MiB) (+95 % **!**) | 127.66 s (download: 27.40 s, 138.6 MiB) (+206 % **!**) | 120.43 s (download: 23.02 s, 133.1 MiB) (+179 % **!**) |
| warm | before | 0.27 s | 0.26 s | 0.37 s | 0.40 s | 0.72 s | 1.04 s | 0.96 s |
| | after | 0.37 s (+36 % **!**) | 0.39 s (+47 % **!**) | 0.66 s (+81 % **!**) | 0.96 s (+139 % **!**) | 1.57 s (+117 % **!**) | 5.25 s (+403 % **!**) | 2.76 s (+186 % **!**) |
| first run after restart | before | 7.04 s | 6.58 s | 6.35 s | 6.76 s | 6.41 s | 6.74 s | 6.60 s |
| | after | 7.92 s (+13 %) | 8.20 s (+25 %) | 7.48 s (+18 %) | 9.30 s (+38 % **!**) | 9.13 s (+42 % **!**) | 21.24 s (+215 % **!**) | 13.21 s (+100 % **!**) |
| repeated after restart | before | 0.15 s | 0.22 s | 0.30 s | 0.40 s | 0.80 s | 0.96 s | 0.84 s |
| | after | 0.36 s (+139 % **!**) | 0.41 s (+85 % **!**) | 0.63 s (+108 % **!**) | 0.93 s (+135 % **!**) | 1.85 s (+132 % **!**) | 5.40 s (+463 % **!**) | 2.44 s (+190 % **!**) |

| by stage | | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| key load | before | 0.09 s | 0.07 s | 0.14 s | 0.17 s | 0.37 s | 0.47 s | 0.51 s |
| | after | 0.08 s | 0.08 s | 0.14 s | 0.23 s (+35 % **!**) | 0.45 s (+22 %) | 2.70 s (+474 % **!**) | 1.57 s (+208 % **!**) |
| witness | before | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| | after | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s | 0.00 s |
| prove | before | 0.17 s | 0.20 s | 0.29 s | 0.36 s | 0.77 s | 0.98 s | 0.90 s |
| | after | 0.30 s (+76 % **!**) | 0.36 s (+82 % **!**) | 0.62 s (+113 % **!**) | 0.92 s (+158 % **!**) | 1.60 s (+108 % **!**) | 5.54 s (+465 % **!**) | 2.69 s (+197 % **!**) |

### Proof, last 9 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`26b47a7`](https://github.com/Tejanadh/ciphra/commit/26b47a74f0c30b0d41ea006a3045f299ea8a918d) | 2026-11-27 | 0.30 s | 0.36 s | 0.62 s | 0.92 s | 1.60 s | 5.54 s | 2.69 s |
| [`f48f358`](https://github.com/Tejanadh/ciphra/commit/f48f358fd33e942784042ab2fa0f483de7edbe62) | 2026-11-27 | 0.17 s | 0.20 s | 0.29 s | 0.36 s | 0.77 s | 0.98 s | 0.90 s |
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 0.24 s | 0.34 s | 0.59 s | 0.91 s | 1.62 s | 4.96 s | 3.26 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 0.30 s | 0.40 s | 0.62 s | 0.88 s | 1.84 s | 3.30 s | 2.63 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 0.43 s | 0.37 s | 0.60 s | 1.01 s | 1.75 s | 3.05 s | 2.72 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 0.28 s | 0.46 s | 0.64 s | 1.12 s | 2.33 s | 3.47 s | 3.67 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 0.27 s | 0.97 s | 0.59 s | 1.09 s | 1.90 s | 4.25 s | 3.38 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 0.25 s | 0.36 s | 0.61 s | 0.92 s | 1.82 s | 3.12 s | 2.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 0.13 s | 0.16 s | 0.27 s | 0.36 s | 0.56 s | 1.03 s | 1.01 s |

### First run after a restart, last 9 commits

| commit | date | 1 → 2 | 2 → 2 | 4 → 2 | 8 → 2 | 16 → 2 | 24 → 2 | merge 24 → 1 |
|---|---|---|---|---|---|---|---|---|
| [`26b47a7`](https://github.com/Tejanadh/ciphra/commit/26b47a74f0c30b0d41ea006a3045f299ea8a918d) | 2026-11-27 | 7.92 s | 8.20 s | 7.48 s | 9.30 s | 9.13 s | 21.24 s | 13.21 s |
| [`f48f358`](https://github.com/Tejanadh/ciphra/commit/f48f358fd33e942784042ab2fa0f483de7edbe62) | 2026-11-27 | 7.04 s | 6.58 s | 6.35 s | 6.76 s | 6.41 s | 6.74 s | 6.60 s |
| [`0096072`](https://github.com/Tejanadh/ciphra/commit/0096072d346fecadbc8808b64b20648dc83d87f1) | 2026-11-27 | 6.90 s | 6.14 s | 7.57 s | 7.89 s | 9.16 s | 19.43 s | 17.07 s |
| [`25204cd`](https://github.com/Tejanadh/ciphra/commit/25204cd88acad8b72976b47b51eb0a9d5a926fa9) | 2026-11-27 | 8.84 s | 9.71 s | 9.48 s | 7.44 s | 14.20 s | 17.95 s | 9.42 s |
| [`751f890`](https://github.com/Tejanadh/ciphra/commit/751f89022a136086dd4c7da83ac8fc738d913d7c) | 2026-11-24 | 14.43 s | 9.85 s | 8.07 s | 8.54 s | 9.46 s | 17.33 s | 10.22 s |
| [`ade42ae`](https://github.com/Tejanadh/ciphra/commit/ade42aec600f8853ca49241452f2ec4642114036) | 2026-11-24 | 11.61 s | 10.84 s | 11.70 s | 11.40 s | 15.29 s | 24.38 s | 17.34 s |
| [`ad976a6`](https://github.com/Tejanadh/ciphra/commit/ad976a6174c6aed25981f4467898ef4f295a914c) | 2026-11-24 | 11.35 s |  | 7.73 s | 13.03 s | 11.57 s | 14.91 s | 14.45 s |
| [`7a9f36d`](https://github.com/Tejanadh/ciphra/commit/7a9f36d68f557f9d701577049f1a2e15a5481239) | 2026-11-24 | 8.81 s | 8.82 s | 8.16 s | 8.61 s | 10.88 s | 13.76 s | 10.72 s |
| [`a1d0355`](https://github.com/Tejanadh/ciphra/commit/a1d03555e6efd27eae68e9d6a1c8365cb1a9f382) | 2026-11-23 | 5.58 s | 6.30 s | 5.94 s | 6.88 s | 5.79 s | 7.47 s | 7.53 s |
