# Dataset shortlist and acceptance checks

Checked 1 October 2026. The pages below are primary dataset/publisher sources. The 2020 candidate has now been downloaded and audited; see [the audit](dataset-audit.md). No dataset has been used for training yet.

## Candidate A — primary construction experiment

[Data on different sized particulate matter concentration produced from a construction activity](https://data.mendeley.com/datasets/6fd493866k/1), Daniel Cheriyan, 2020, DOI `10.17632/6fd493866k.1`, CC BY 4.0.

The dataset page describes PM10, PM2.5 and PM1 collected during block-wall construction over 40 minutes at two-second intervals. The associated [Data in Brief article](https://pmc.ncbi.nlm.nih.gov/articles/PMC7644872/) describes raw, analyzed and filtered data and links this dataset. It reports that the Sharp sensor saturated; use its readings only after a channel-specific suitability check.

Priority: audit the actual files first. Verify which files are raw, chronological order, sensor IDs, duplicates, missingness and physical units. Check saturation and whether any smoothing uses future samples. Wind measurements and boundary coordinates have not been established by the pages inspected. Do not invent them. One experiment is limited evidence even if several sensors produce many rows.

Audit outcome: the downloaded workbook contains only PM10 ten-minute moving averages with undocumented alignment. Reject it for raw 30-second forecasting. It may be shown as a labelled descriptive processed trace. The advertised raw PM2.5/PM1 channels are absent.

## Candidate D — newer construction and outdoor measurements

[Data on different particulate matter profiles produced in laboratory from construction activity and outdoor monitoring](https://data.mendeley.com/datasets/7f22n9v7hp/1), Komiljon Askarov and Jae-ho Choi, 2024, DOI `10.17632/7f22n9v7hp.1`, CC BY 4.0.

Audit outcome: the verified nested ZIP has separate raw and analysed files. Raw OPC-N3 exports provide twelve laboratory recordings with 53,717 rows at approximately one-second cadence, plus two outdoor recordings. Accept raw laboratory `PM10(ug/m3)` for the preliminary 30-second monitor forecast, subject to the frozen preparation rules in [the audit](dataset-audit.md). Exclude `RollMean_*` columns. Date precision, duplicate timestamps, one sensor/setup and changed experimental conditions are recorded limitations. The similar `ffr6869fr7` release is not counted as independent evidence.

## Candidate B — related construction dataset

[Construction Particulate Matter Concentration Data](https://data.mendeley.com/datasets/wy6shdctsr/1), Jae-ho Choi and Daniel Cheriyan, 2019, DOI `10.17632/wy6shdctsr.1`, CC BY 4.0.

Its description says two-second sampling, a 40-minute activity and released PM10 readings filtered with a ten-minute moving average. Audit the actual smoothing method. This may describe related measurements rather than a separate independent experiment; do not count it as an external test until provenance confirms independence. Prefer Candidate A's raw files. Unexplained/centered smoothing prevents a clean short-horizon forecast claim.

## Candidate C — separate ambient benchmark

[UCI Beijing Multi-Site Air Quality](https://archive.ics.uci.edu/dataset/501/beijingmultisiteairqualitydata), DOI `10.24432/C5RK5G`, CC BY 4.0.

The official record lists 420,768 hourly observations at 12 stations over March 2013–February 2017, with PM2.5, PM10 and meteorological variables including wind. It has missing values. It is a stronger-volume benchmark for hourly ambient forecasting, but it does not label construction emissions or provide site-boundary ground truth.

Use only at native hourly resolution, with one-hour or longer targets, and label this task separately. Do not pool it with two-second construction rows or attach its weather observations to another experiment.

## Download and audit deliverables

Create `data/manifest.json` with source DOI/URL, version, access date, terms, exact downloaded filenames, byte sizes and SHA-256 hashes. Keep `data/raw/` and `data/processed/` untracked. Attribute each accepted dataset in the README, report and website's dataset card. Download only necessary files with a repeatable script; commit an appropriately licensed small fixture if tests need one.

Create `docs/dataset-audit.md` with actual row/channel counts, elapsed range, gaps, units, PM distributions, sensor saturation, preprocessing, independent episode count and available contextual signals. Provide a deterministic schema mapping and data-quality plots. Then record the accepted target, sampling interval, forecast horizon, sensor selection and reason in `docs/decisions.md`.

Decision at the end of the first audit: accept Candidate A, choose a documented measured alternative, or report that additional suitable data is needed. An inaccessible file is not an acquired dataset. Synthetic observations must have their own manifest and cannot be described as recorded data.
