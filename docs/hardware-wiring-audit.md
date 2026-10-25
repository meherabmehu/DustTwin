# Hardware wiring and usability audit

Baseline: commit 558ee8b, 59 components and 165 connections. All IDs and endpoints must remain present. Budget allocations total BDT 120,000; no hardware has been added by this interface update.

The previous renderer used a midpoint dogleg for every connection without testing component obstacles. Its thirteen recycled lanes placed unrelated wires on top of each other. Fixed 4150-unit bounds also applied to sparse subsystems, and tab changes scrolled to one section without fitting all relevant equipment. The SVG drew wires over component bodies. The previous subset omitted external connections without explaining their destinations. WIRING_NOTES still described six SPS30/two SHT35 modules although the authoritative manifest correctly has four/one.

The existing reducer, serial frames, Python host and firmware already implement sensor sampling, risk/zone decisions, interlocks, damper feedback, airflow, misting and fault handling. Browser execution is a functional model, not ESP32 instruction emulation. Firmware compilation does not establish electrical or physical verification.

Electrical review is against selected references, not procurement approval:

- SPS30 requires 4.5–5.5V supply, separate from 3.3V bus pull-ups: https://sensirion.com/file/datasheet_sps30
- TCA9548A supports separate bus voltage domains; configured VCC/pull-ups are 3.3V, address 0x70, SPS30 0x69 on channels 0–3 and SHT35 0x44 on channel 4. Only one channel is enabled: https://www.ti.com/lit/ds/symlink/tca9548a.pdf
- DevKitC V4 WROOM carrier pin order and input-only GPIO34–39 match the selected reference: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html
- Pressure ADC must receive conditioned 0–3.3V, not field sensor output. Divider, clamps, calibration, pulse buffering, switch pull-ups and shared return bonds are designed assembly requirements, not verified purchased modules.
- MAX3485 requires 3.3V logic, matched Modbus parameters, unique device addresses, termination, reference/EMC and surge design. Exact sensor revisions remain to be verified.
- Additional primary references reviewed: [MAX3485](https://www.analog.com/en/products/max3485.html), [SHT35](https://sensirion.com/products/catalog/SHT35-DIS-B), [SEN0483](https://wiki.dfrobot.com/sen0483/), [SEN0482](https://wiki.dfrobot.com/sen0482/) and [SEN0257](https://wiki.dfrobot.com/sen0257/). Product family/revision pages do not verify a purchased assembly or unspecified carrier header.
- Driver bank is an assumed protected multi-domain assembly with 3.3V inputs, separate 24V/12V load domains, flyback and fail-off biasing. It is not a generic relay board.
- Delivered damper travel/current, valve coil current, pump inrush/pressure curve, motor/contactor ratings, fuse ratings, earth/RCD coordination and isolation remain pending. Mains connections denote enclosed subsystem interfaces only.

Configured means present in the manifest. Reference checked means named voltage/pin/interface checks pass for the selected reference. Firmware compiled means a current source-hash build exists. Firmware executed and physically verified remain false until real evidence is available. No estimated airflow/capture result establishes open-air dust capture performance.

## Implementation and verification

The new grid A* router uses exact geometry anchors, component/card keep-outs, turn costs and congestion costs. It has no silent straight-line fallback. Route tests check every segment in all nine views against every other card, as well as orthogonality and exact endpoint coordinates. Layout tests check card separation and canvas bounds. Exact connection endpoints are protected by a baseline SHA-256 signature, not only a connection count. Shared buses group only identical source component/pin/type/voltage; mechanical paths remain explicit.

Subsystems now include a complete external-reference inventory. Both internal and external links partition every connection touching a displayed component. Cross-subsystem references open the selected full route. Layout is memoized between simulation ticks; navigation never changes pin assignments or simulation behavior.

Executed checks: `npm.cmd ci --cache .tooling/npm-cache`, **106 frontend unit tests**, production build, **16 hardware Python tests** with real local AI, and all four PlatformIO targets (`sensor`, `actuator`, `sensor-sim`, `actuator-sim`). The full Chromium regression exercises all 26 scenarios, manual interlocks, independent channels, WebGL camera changes, configuration persistence/validation, ZIP export, actual AI prediction and outage recovery, Python host control/fail-off, desktop/mobile and all nine existing routes. The dedicated wiring browser test checks fitting, bus expansion, pin/wire highlighting, category filters, isolation, pointer zoom, drag-to-pan, mini-map navigation, sidebar centering, tab fitting after selection and fullscreen, including the production preview.

The unchanged backend suite still reports 22/23 passing: `test_saved_case_is_deterministic` fails an exact saved-case comparison involving environment hash and platform floating-point differences, as previously documented. No saved model/dataset/evaluation evidence was changed to conceal it. Set `OMP_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`, `MKL_NUM_THREADS=1` for a bounded local backend test run. npm still reports two pre-existing high-severity dependency advisories; dependency upgrades are outside this hardware-only change.
