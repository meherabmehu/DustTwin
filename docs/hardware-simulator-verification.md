# Hardware Simulator verification — 25 October 2026

Implemented in the existing application at `/hardware-simulator`. Only the route import/entry and navigation entry change existing frontend files. All simulator behavior, styling, documentation, tests and the proposed actuator scaffold live in new files. No dependencies, backend content, trained artifact or evaluation data were changed.

## Completed checks

- `npm.cmd ci --cache E:\DustTwin\.npm-cache`: passed with the existing lockfile. PowerShell's script execution policy blocks `npm.ps1`, so the native `npm.cmd` entry point was used. npm reported two high-severity findings in the existing dependency tree; no unrelated dependency upgrades were made.
- `npm.cmd test`: **92 passed**, including 22 hardware tests and all existing frontend tests.
- `npm.cmd run build`: passed; includes TypeScript project checking and production Vite output.
- Headless Chromium via `tests/browser/hardware-smoke.cjs`: passed against both Vite development and production preview servers with the actual local inference backend. Tested 52 components, subsystem filtering/collapse, wire inspector, zoom controls, all 14 scenarios, sensor controls, manual requests, emergency stop, power failure, code tabs, invalid JSON rejection, configuration application, local persistence, file/log downloads, reset/clear, real 30-second model inference, API outage and recovery, all eight existing routes plus the new route, and desktop/mobile layout. No uncaught browser errors; no document overflow at 390px width.
- Central wiring endpoint/voltage/driver validation: passed for all 144 modeled electrical and air/water connections.
- Firmware GPIO consistency: proposed actuator output order matches the central hardware mapping. Firmware compilation, flashing and physical execution were not performed and are not claimed.

## Existing backend regression result

`.\ai-backend\.venv\Scripts\python.exe -m unittest discover -s ai-backend/tests` ran **23 tests: 22 passed, 1 failed**. The failure is `test_simulation.SimulationTests.test_saved_case_is_deterministic`, an exact saved-case equality comparison. A read-only recursive comparison found a different `environment_sha256` and floating-point differences such as `1786.1972355008847` versus `1786.1972355008845`. This is consistent with platform/numerical reproducibility differences; the simulator does not import or change the Python simulation implementation.

`git diff --quiet -- ai-backend` returned zero (no content differences). The backend paths already appeared modified in the starting working tree due to working-copy normalization; they were left untouched and excluded from the simulator commit. Saved evidence was not regenerated to conceal the failure. The actual inference API still returned verified `live_inference` forecasts during browser testing.

## Scope and physical-integration limits

This is the requested functional simulator, not an arbitrary ESP32 C++ executor or electrical/CFD solver. Source editing saves/exports working copies; only validated JSON configuration changes runtime behavior. The sensor source is explicitly the existing legacy sketch, the Pi source is the actual inference module, and the new actuator source is a proposed fail-off scaffold. Complete physical sensor acquisition and a production serial bridge remain hardware-integration work, clearly described in the page and [model reference](../public/docs/hardware-simulator.md).

Exact unprovided field-device models, load ratings, connectors, supply capacities and protective-device sizing remain pending equipment selection. The circuit identifies protected subsystem interfaces and does not invent their manufacturer pinouts. AI model outputs on virtual input are outside the original laboratory validation domain and carry no new accuracy claim.
