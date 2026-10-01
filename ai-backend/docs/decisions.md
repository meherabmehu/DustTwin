# Handoff decisions

## 1 October 2026 — Public teammate package

The user authorized a new public GitHub repository with a suitable name. Use `arifshekhk8/DustTwin-Model-Integration`. Package the trained backend for the team's existing frontend; keep its design and source with its owner. The model is small enough to track directly, so no separate artifact download is necessary.

## Preserve the trained task

Copy the frozen model/configuration/preparation and evaluation unchanged from `DustTwin-AI` at `ea5c9c5`. The learned model improves MAE over persistence but loses to the trailing mean. Preserve both baselines and all limitations. No training or new test tuning is part of this handoff.

## Separate frontend and backend

An existing website can call the Python API through an explicit origin allowlist, or a same-origin reverse proxy. Default cross-origin access is disabled until configured. The backend runs locally by default and does not require the upstream website or Node. Public repository visibility is separate from backend hosting.

## Evidence and continuity

Recorded replay remains attributed CC BY 4.0 data. Simulation remains uncalibrated software, separate from measured forecast errors. The existing daily automation belongs to the upstream project; no duplicate automation is created here. Round 1 remains software only.
