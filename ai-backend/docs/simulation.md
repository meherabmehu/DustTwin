# Shared site-control experiment — completed S1

1 October 2026. This is an **uncalibrated software simulation**, separate from measured forecast evaluation. Frozen settings are in `experiments/scenarios/defaults.json`; full traces and hashes in `demo/simulation/`; trace-derived metrics in `reports/simulation/summary.json`.

## Common environment and information

All four strategies use the same 480-second source/wind/availability timeline, 120 × 80 m layout, ambient PM10 of 40 µg/m³, zone flow of 0.5 L/min, assumed 65% removal of incoming construction contribution, five-second actuation delay and minimum on/off intervals of fifteen seconds. A/B/C/D mean north/east/south/west. Wind is meteorological wind-from; plume travel adds 180 degrees. The plant alone owns future events. Controllers receive current/past observations; a future-perturbation check confirms earlier decisions cannot change.

Source readings are a synthetic concentration proxy, **not an emission rate**. A dimensionless 0.22 gain, cosine-squared directional weighting, distance/speed delay and twelve-second boundary response map that proxy into the assumed site. The ambient component is never mist-suppressed. These choices are illustrative and have no field calibration. There is no humidity input or particle-size multiplication masquerading as measured PM channels.

The actual frozen laboratory model receives only 121 past synthetic source-proxy concentrations. Its 30-second endpoint is linearly connected to the latest source value to create a declared source trajectory. A forward untreated boundary rollout uses known queued past source/wind and holds future wind at the latest observation. This maps a learned endpoint into an assumed spatial trajectory; it does not turn laboratory MAE into boundary accuracy. Crossing states are already exceeded, a computed future crossing or no crossing within thirty seconds. The trajectory method is named, with no probability/confidence claim.

Predictive activation/release considers every above-setting boundary, subject to the same actuator rules. Reactive activates at 250 and releases below 200 µg/m³; predictive also considers the untreated forward peak for both activation and release. These are demo settings, not regulatory limits. Default capacity permits all four zones, including both diagonal risks. On missing boundary data, both adaptive strategies request all zones under the same switching limits. Predictive uses a labelled reactive fallback until its full source/wind lookback is complete.

## Saved eight-minute results

Mean PM is the mean of the maximum among all four boundary concentrations at each one-second interval end, in µg/m³. Water is litres. Exceedance seconds use the 250 µg/m³ maximum-boundary setting. Every value comes from the saved traces.

| Scenario / strategy | Water L | Mean max PM10 | Exceedance s | Zone switches |
|---|---:|---:|---:|---:|
| Low risk / no control | 0.000 | 56.369 | 0 | 0 |
| Low risk / continuous | 16.000 | 45.774 | 0 | 4 |
| Low risk / reactive | 0.000 | 56.369 | 0 | 0 |
| Low risk / predictive | 0.000 | 56.369 | 0 | 0 |
| East / no control | 0.000 | 294.634 | 203 | 0 |
| East / continuous | 16.000 | 129.167 | 86 | 4 |
| East / reactive | 1.250 | 175.952 | 122 | 4 |
| East / predictive | 1.842 | 149.962 | 86 | 2 |
| Diagonal / no control | 0.000 | 172.444 | 139 | 0 |
| Diagonal / continuous | 16.000 | 86.378 | 0 | 4 |
| Diagonal / reactive | 1.083 | 145.890 | 68 | 12 |
| Diagonal / predictive | 2.517 | 108.793 | 0 | 4 |
| Wind shift / no control | 0.000 | 281.153 | 196 | 0 |
| Wind shift / continuous | 16.000 | 124.448 | 86 | 4 |
| Wind shift / reactive | 1.283 | 173.906 | 134 | 6 |
| Wind shift / predictive | 2.025 | 143.850 | 86 | 4 |
| Data loss / no control | 0.000 | 294.634 | 203 | 0 |
| Data loss / continuous | 16.000 | 129.167 | 86 | 4 |
| Data loss / reactive | 2.000 | 175.952 | 122 | 10 |
| Data loss / predictive | 2.467 | 156.973 | 104 | 10 |

Under these assumptions predictive control trades additional water relative to reactive for lower modeled exposure. Continuous spraying generally has the lowest mean concentration and highest water use. Predictive is not a universal winner and cannot prevent every modeled exceedance. Do not extrapolate these eight minutes into a daily field saving or causal suppression percentage.

## Reproduction and tests

```sh
.venv/bin/python scripts/run_simulation.py
.venv/bin/python scripts/verify_simulation.py
.venv/bin/python -m unittest discover -s tests -v
```

Twenty focused Python tests pass. Checks cover wind conversion, two-edge exposure, exact saved-case determinism, future timeline isolation, unavailable/fallback states and crossing semantics. Independent verification integrates all 9,600 intervals across twenty runs: water, mean/peak/exceedance/exposure, zone duty/switching, minimum intervals, capacity, ambient floor and hashes agree.

The first future-isolation assertion included the exact instant when a changed source reading became observable. It was corrected to compare complete records strictly before that time and controller decisions at that instant (issued one second earlier). Those decisions agree; no controller implementation was changed to hide future data.

`GET /v1/scenarios` and `/v1/scenarios/{id}` serve pinned saved experiments. `POST /v1/simulate` reruns all four strategies after validated source/wind/flow/effectiveness changes; it needs the real model and never tunes it. Changes are applied to every strategy, and custom runs remain labelled uncalibrated simulation.
