# Hardware Lab delivery and validation — 25 October 2026

The latest approved reference and revised budget supersede the prior six-PM/two-SHT specification. The existing `/hardware-simulator` now models **four SPS30s and one SHT35**, with all other required controllers, extraction/misting equipment and safety devices retained. This is an extension of the existing DustTwin application; no separate application was created.

## Implemented and audited

- Reference-style left navigation/searchable component library; top PM/environment/power groups, middle Pi/dual-ESP32/communication/driver groups, and bottom extraction/misting groups on a large scrollable SVG workspace.
- Individually drawn equipment: Pi PCB, full DevKitC V4/WROOM carrier pins, SPS30 housings, I²C board, relay bank, motor/valve/damper/wind equipment, protected supplies, pull-ups and breaker. Each modeled connection terminates on selectable anchors. Pin/wire inspection, both-endpoint highlight, trace-to-destination, category filters, subsystem dependency isolation, fit/reset/zoom/pan/full-screen and SVG/CSV exports operate on the actual graph.
-59 components and165 electrical/air/water connections in one authoritative manifest. Generated firmware definitions, wiring CSV and public manifest share that source. GPIO conflict/voltage/driver checks and drawable anchor tests pass. Structural validation does not certify electrical safety.
- Four independent PM1/PM2.5/PM4/PM10 channels, individual overrides/sample intervals/noise/faults, existing deterministic risk and wind/lead modules, explicit strategy rules, four-zone travel/feedback interlocks, duct-resistance/pressure-limited flow, captured mass/cyclone/bin/HEPA accumulation, wet pressure/flow/tank integration and26 reproducible scenarios.
- Start/Pause/Resume/Stop/Reset/Step/speed/manual/automatic/emergency controls. Generated serial events and explicit sequence/session/ACK/heartbeat/reconnect behavior. Stuck/open/closed, sensor, wind, Pi/link, motor/filter, pump/valve/pressure/tank, power and stop faults affect actual outputs.
- Actual WebGL tabletop geometry, not a static image: four plots, sensors, wind mast, dry/wet systems and control enclosure, with state-driven airflow/spray/fan behavior and real Top/Side/Isometric/zoom/orbit/rotation camera controls.
- Real project source workspace with local working-copy save/reset/export, a valid firmware ZIP archive, checked-in-project build results, and source-hash verification that rejects stale compilation evidence. Only validated simulation JSON applies to the browser; source edits do not silently execute.
- Hardware-independent executable Python host, browser bridge, real USB/TCP/RFC2217 transports, telemetry validation, controller/ACK watchdogs, causal AI integration, JSONL logging and safe reconnect. The browser can explicitly use its returned commands to drive virtual actuators. This is PC/Pi-compatible application code, not Raspberry Pi emulation.
- Existing trained-model client/API retained. North PM10 collects121 actual one-second samples, no invented warm-up. Genuine30s forecasts, offline/retry handling and later-only matured virtual comparison are implemented; no new accuracy claim or direct AI zone prediction is made.
- Complete readiness/BOM, proposed reference parts and manufacturer links, power/calibration/interlock/assembly checklist and BDT120,000 planning allocation within the requested target range. Allocations are not current supplier quotes or a procurement guarantee. No component is marked hardware-tested.

## Actual verification

| Check | Result |
| --- | --- |
| `npm.cmd ci --cache E:\DustTwin\.npm-cache` | Passed using existing lockfile after stopping the repo's locked Vite/esbuild processes; dependencies unchanged. |
| `npm.cmd test` |100 passed, including physical anchor/layout inventory, protocol/physics/fault tests and27 Python/TypeScript parity fixtures. |
| `npm.cmd run build` | Passed TypeScript and production Vite compilation. |
| `DUSTTWIN_TEST_AI_URL=http://127.0.0.1:8000 python -m unittest discover -s hardware/tests` |16 passed, no skips: real AI API, TCP transport, Python browser bridge, causality, watchdogs, safety and matching firmware source/binary hashes. |
| `python hardware/tools/generate.py --check` | Passed; generated definitions/table/manifest match authority. |
| `python hardware/tools/build.py` | All four real ESP32 targets compile: sensor, actuator, sensor-sim, actuator-sim, pinned PlatformIO espressif32@6.10.0, ArduinoJson7.3.1. Compiler logs and hashes are in `public/hardware/build-status.json`. |
| Chromium browser test | Circuit/search/filter/trace/zoom/full-screen, all26 scenarios, independent inputs/manual interlocks, actual WebGL camera changes, source saving/config validation/ZIP export/readiness, real AI and matured comparisons, offline recovery, Python-host-to-virtual-actuator control/fail-off, mobile layout and all existing routes passed. |
| Existing Python/backend suite |22/23 passed. The unchanged exact saved-simulation comparison still fails from environment-hash/tiny floating-point differences, as recorded for the initial implementation. No frozen evidence was regenerated. |

PowerShell blocks `npm.ps1` under its script policy; `npm.cmd` is the same package command's native entry point. npm reported two existing high-severity dependency findings; no unrelated dependency upgrade was made. Temporary toolchains/browser dependencies remain ignored and are not included in commits.

An automatic approval-service usage limit briefly prevented a rebuild. After the service's stated reset time elapsed, the same real compiler command was approved and completed. The final build report corresponds to the revised four-sensor source; the temporary review failure is resolved.

## Firmware and external execution limits

`hardware/firmware/src/sensor.cpp` and `actuator.cpp` are the actual buildable controller sources. `hardware/firmware/include/hardware.generated.h` comes from the manifest. `hardware/pi/app.py`, `controller.py`, `protocol.py`, `transport.py` and `config.json` implement the host architecture. Wokwi directories contain real ELF/bin references, GPIO/serial diagrams and scenarios; the supplied serial bridge accepts RFC2217 and explicitly injected virtual input.

Actual external Wokwi execution was **not performed**, because no licensed runtime/token is configured. Compilation, Python-host execution, modeled peripherals and physical hardware are distinguished throughout the UI. The former two-PM legacy demo remains unchanged for its existing feature; the obsolete previous hybrid scaffold was retired. No physical GPIO/device tests or electrical/CFD certification are claimed.

Exact load ordering codes, supply/inrush budgets, carrier connectors, pull-ups/rise times, RS485 EMC/termination, feedback circuits, protective devices/earth, independent emergency disconnect, actual damper travel, sensor/flow/pressure calibration, pump/fan curves and capture/misting effectiveness require physical verification. These requirements appear in the readiness section and full guide at `public/docs/hardware-simulator.md`.

## Preservation review

Only the existing Hardware Simulator and its supporting modules, project scripts/tool ignores, hardware source, tests and documentation changed. No content changes were made to the existing other pages, route table/navigation, trained artifact, original datasets, evaluation results or team data. Backend working-copy normalization entries were present at the start, left untouched and excluded from this change. Git commit/push results are reported from actual Git output separately.
