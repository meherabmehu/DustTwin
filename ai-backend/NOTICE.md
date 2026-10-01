# Reuse and attribution

The project code, connection examples, documentation and fitted model are provided under the MIT license. Third-party Python packages keep their own licenses; install them from the pinned requirements rather than copying an environment.

The recorded measurements and their derived grids, exported measured traces, fixtures, plots and data summaries retain the following dataset attribution and CC BY 4.0 terms. Our changes include causal one-second gridding, feature extraction, predictions, evaluation and visualization. Original source downloads were not edited and are not bundled. Dataset contributors do not endorse this project.

- Komiljon Askarov and Jae-ho Choi (2024), [Data on different particulate matter profiles produced in laboratory from construction activity and outdoor monitoring](https://data.mendeley.com/datasets/7f22n9v7hp/1), Mendeley Data V1, DOI `10.17632/7f22n9v7hp.1`, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Accepted raw laboratory OPC-N3 PM10 task. Attribution also appears in `demo/replay/index.json`.
- Daniel Cheriyan (2020), [Data on different sized particulate matter concentration produced from a construction activity](https://data.mendeley.com/datasets/6fd493866k/1), Mendeley Data V1, DOI `10.17632/6fd493866k.1`, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Included only as a descriptive audit of released ten-minute averages; rejected for raw short-horizon training.

The backend and frozen evidence come from [DustTwin-AI](https://github.com/arifshekhk8/DustTwin-AI) at commit `ea5c9c5b9b3833a9f645bd431806fd75cd621770`. Exact unchanged files are listed in `models/upstream-provenance.json`. This handoff adds API-origin configuration, connection examples and handoff instructions. It does not include the original teammate frontend or its dependencies.
