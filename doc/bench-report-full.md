# Bench Analyze Report

- 输入：`bench-full.json`
- 参数：seeds=1,2,3,4,5,6,7,8,9,10 levels=1,2,3,4,5 waves=5 speed=8×
- nodes-matrix：`balanced=energy,turret,mine,shield,relay;noMine=energy,turret,shield,relay;noShield=energy,turret,mine,relay;turretRush=energy,turret;shieldDefense=energy,shield,relay`
- 总 runs：250（5 pool）

## 1. 总览（按 pool 聚合）

| pool | n | won | gameover | reached_target | error | avgScore ± sd | avgWave ± sd | avgTicks |
|------|--:|----:|---------:|---------------:|------:|--------------:|-------------:|---------:|
| balanced | 50 | 0 | 0 | 50 | 0 | 5.8 ± 21.3 | 5.00 ± 0.00 | 120 |
| noMine | 50 | 0 | 0 | 50 | 0 | 2.6 ± 8.8 | 5.00 ± 0.00 | 120 |
| noShield | 50 | 0 | 0 | 50 | 0 | 1.6 ± 6.2 | 5.00 ± 0.00 | 120 |
| turretRush | 50 | 0 | 0 | 50 | 0 | 1.7 ± 8.8 | 5.00 ± 0.00 | 120 |
| shieldDefense | 50 | 0 | 0 | 50 | 0 | 3.1 ± 8.9 | 5.00 ± 0.00 | 120 |

## 2. 时序：按 pool × wave_end 聚合

### pool: `balanced`

| wave | n | avgScore ± sd | avgEnemy | avgNodes | avgElapsedMs |
|-----:|--:|--------------:|---------:|---------:|-------------:|
| 1 | 50 | 0.0 ± 0.0 | 0.0 | 39.0 | 1982 |
| 2 | 50 | 0.3 ± 2.1 | 3.0 | 39.0 | 3860 |
| 3 | 50 | 1.2 ± 5.1 | 10.9 | 39.0 | 5737 |
| 4 | 50 | 5.8 ± 21.3 | 20.7 | 39.0 | 7611 |

### pool: `noMine`

| wave | n | avgScore ± sd | avgEnemy | avgNodes | avgElapsedMs |
|-----:|--:|--------------:|---------:|---------:|-------------:|
| 1 | 50 | 0.0 ± 0.0 | 0.0 | 39.0 | 1972 |
| 2 | 50 | 0.3 ± 2.1 | 3.0 | 39.0 | 3853 |
| 3 | 50 | 0.9 ± 3.6 | 10.9 | 39.0 | 5728 |
| 4 | 50 | 2.6 ± 8.8 | 20.8 | 39.0 | 7604 |

### pool: `noShield`

| wave | n | avgScore ± sd | avgEnemy | avgNodes | avgElapsedMs |
|-----:|--:|--------------:|---------:|---------:|-------------:|
| 1 | 50 | 0.0 ± 0.0 | 0.0 | 39.0 | 1973 |
| 2 | 50 | 0.0 ± 0.0 | 3.0 | 39.0 | 3852 |
| 3 | 50 | 0.0 ± 0.0 | 11.0 | 39.0 | 5731 |
| 4 | 50 | 1.6 ± 6.2 | 20.9 | 39.0 | 7603 |

### pool: `turretRush`

| wave | n | avgScore ± sd | avgEnemy | avgNodes | avgElapsedMs |
|-----:|--:|--------------:|---------:|---------:|-------------:|
| 1 | 50 | 0.0 ± 0.0 | 0.0 | 39.0 | 1978 |
| 2 | 50 | 0.0 ± 0.0 | 3.0 | 39.0 | 3859 |
| 3 | 50 | 1.2 ± 6.7 | 10.9 | 39.0 | 5734 |
| 4 | 50 | 1.7 ± 8.8 | 20.9 | 39.0 | 7608 |

### pool: `shieldDefense`

| wave | n | avgScore ± sd | avgEnemy | avgNodes | avgElapsedMs |
|-----:|--:|--------------:|---------:|---------:|-------------:|
| 1 | 50 | 0.0 ± 0.0 | 0.0 | 39.0 | 1974 |
| 2 | 50 | 0.0 ± 0.0 | 3.0 | 39.0 | 3857 |
| 3 | 50 | 1.3 ± 5.0 | 10.9 | 39.0 | 5729 |
| 4 | 50 | 3.1 ± 8.9 | 20.8 | 39.0 | 7609 |
