# DustTwin Hardware Lab — revised four-SPS30 prototype

The existing `/hardware-simulator` route implements the approved reference direction with individual SVG equipment, independently clickable pin anchors, traceable colored connections, subsystem navigation, a searchable component library, live monitoring and a real interactive WebGL tabletop preview. It is **Functional Hardware Simulation — Firmware Not Emulated**. The website is not a physical circuit solver or an ESP32 emulator.

## Revised inventory and authority

The latest requested inventory supersedes the earlier six-PM/two-SHT design: **four SPS30 sensors** at North/A, East/B, South/C and West/D, and **one SHT35**. Each SPS30 channel contains PM1, PM2.5, PM4 and PM10. The Pi5 8GB, both ESP32 controllers, wind instruments, flow/pressure/HEPA sensors, four dampers/inlets, cyclone, HEPA, collection container, four valves/nozzles, tank, pump, test fan, power systems and safety components remain present.

`hardware/manifest.json` is authoritative for components, electrical/air/water connections, GPIO assignments, DevKitC carrier header order, protocol timing, field calibration defaults, power references and budget allocations. Run `python hardware/tools/generate.py` to generate the firmware header and downloadable wiring table/manifest. `--check` detects stale generated outputs. Never edit the generated header independently.

Circuit renderers terminate every wire on a named anchor from the component geometry. Selecting a wire highlights both endpoints and shows its purpose, voltage, current-sizing note, interface and isolation requirement. Clicking a pin filters its connections. Unconnected ESP32 carrier pins remain inspectable; flash pins are marked reserved. USB links are connector-level bundles containing power, ground and differential data, not individual GPIO UART wires. Mechanical ports are labeled AIR/WATER and are not electrical pins.

## Wiring workspace navigation

All 59 components and 165 connections remain represented. The orthogonal router avoids other component cards, reserves clearance around labels, and penalizes congested lanes. Shared source-pin buses are collapsed by default into matching B labels; use a bus button or **Expand shared buses** to reveal every underlying route. Clicking a bus branch expands its exact route. Crossing lines have no junction; connected pins have visible dots. Air and water paths use distinct colors/dashes and follow modeled pump/motor states.

Use the nine subsystem tabs, including Communication and Safety & Protection, for readable focused views. Detailed views open at a readable minimum 85% scale and permit pan; Fit Subsystem keeps pin text readable. System Overview has a separate compact architecture layout with every component represented. Fit Overview explicitly shows that whole architecture; Actual Size is 100%, and Reset View restores the readable default. External links are listed with both source and destination pins under Cross-subsystem connectors, and marked on affected cards. Selecting one opens the full circuit and its wire inspector; external links are never presented as disconnected wires.

Wheel zoom stays at the pointer and prevents page scroll. Drag empty canvas to pan; the mini-map jumps to a region. **Center selected component** gives a readable component scale. Sidebar search centers the selected part and traces its connections. F fits, C centers, +/− zoom, and Escape clears selection filters/exits fullscreen while the canvas has focus. Fullscreen retains the inspector and restores the previous zoom/pan when closed; Escape preserves selected wires and pins. Mode changes retain the detailed camera, and simulation updates never alter it. The mini-map can be toggled on demand so it does not cover hardware by default. Pin, component, wire, category and shared-bus filters all use the authoritative connection model. **Reset wire visibility** restores every category and clears isolation.

The inspector separates live modeled state from configured pin/interface rules and pending physical verification. Reference-rule success is not electrical certification. Exact relay/driver, field-device connector, protection, coil and pump selections still require the commissioning checks below.

The reference image is a visual target. Documented reference interfaces take precedence over its illustrative pin names, voltage labels and device counts. Device SVGs are recognizable vector representations, not scale-certified assembly drawings. Only the selected DevKitC V4/WROOM carrier has the full documented 38-pin header layout; unspecified carriers and driver assemblies use explicitly proposed logical interfaces without invented connector numbers.

## Controls and workspace

Start/Resume explicitly arms the model, Pause freezes its virtual clock while holding outputs, Stop de-energizes and disarms, Reset restores initial conditions, and Step advances one second while stopped/paused. Speed changes the wall-clock interval, not the one-second deterministic integration step. Emergency stop remains available while paused. The event log records actual model transitions and protocol exchanges, not a fixed sequence of demo messages.

The left rail opens Complete System, 3D view, circuit, controller/sensor/dry/wet/power views, source editor, scenarios, telemetry, actuators, BOM and SVG wiring download. Subsystem filtering includes needed upstream power/reference dependencies, and renders no connection with a hidden endpoint. Category filters affect visibility only; the complete authoritative graph stays exportable. Fit is an overview; zoom in to read individual pins. Reset View restores the working magnification. Full-screen mode enlarges the circuit, and the inspector can be collapsed/resized.

Physical View uses actual WebGL boxes, cylinders, cones and animated flow/spray geometry. Top/Side/Isometric, zoom, rotation and pointer orbit alter the camera matrix. A missing WebGL runtime is reported explicitly. The scene shows the four plots, boundary sensors, mast/vane, suction/ducts/dampers, cyclone/bin/HEPA, water system and controller enclosure. It is an illustrative tabletop model, not a rotatable photograph or a fabrication model.

## Virtual sensors and functional physics

Each boundary channel has separate pollutant values, validity/fault, sample time, interval, deterministic sinusoidal noise and optional direct override. Baseline directional concentrations use the existing project's boundary geometry/alignment factors. The four channels are not copied from one shared readout. The global PM controls set the untreated peak used by this transport model; they preserve per-device noise/interval/fault settings. Invalid cumulative size bins or PM10 below PM2.5 inhibit suppression. PM1 and PM4 in the browser are illustrative fractions/interpolations; physical sensor firmware reads their actual SPS30 values.

Suppression changes subsequent modeled PM values: concentrations approach the untreated directional target through a first-order mixing term, with dry extraction and active misting removal terms. These are configurable functional assumptions, not measured field-removal efficiencies.

Damper travel progresses through OPENING/OPEN/CLOSING/CLOSED. Suction waits for every requested damper to confirm open. Branch flow is `sqrt(max(0, fanStaticPa - filterPa) / branchResistance) * opening`, scaled so total flow never exceeds nominal motor capacity. This is an uncalibrated pressure/resistance approximation, not a fan-curve/duct-design certification. Insufficient branch airflow generates a warning. Estimated captured grams integrate `flow_m3h / 3600 * PM10_ugm3 / 1e6 * captureEfficiency`. The cyclone fraction enters the bin; the remaining HEPA fraction accumulates filter loading. Differential pressure grows with loading, and trips extraction at its setting.

Misting uses the existing project's risk-dependent per-zone flow. Water use integrates L/min over virtual seconds and depletes the tank. A running pump and open valve are both required for spray. Nominal modeled pressure is 3bar, reduced near an empty tank. Low water, pump failure, pressure loss and stuck-valve faults isolate the wet system. These assumptions require pump/nozzle curves and physical calibration before use.

Strategies are No Control, Dry Extraction, Targeted Misting and Hybrid Control, plus an automatic planner: hood drilling chooses dry extraction, open-air soil chooses targeted misting, mixed work chooses hybrid, and high wind in open-air work favors wet control. These are explicit demonstration policies. Open-air extraction is not assumed accurate or feasible just because its motor is on.

## Electrical reference and assembly limits

The proposed carrier is **Espressif ESP32-DevKitC V4 with WROOM-32E**, not C3/S3 or WROVER. USB/UART0 connects both boards to the Pi. Sensor GPIO21/22 serve 100kHz I²C; UART2 RX16/TX17 and DE4 serve the 3.3V RS485 transceiver; GPIO32 is conditioned flow, GPIO35 conditioned water pressure, and GPIO27 a normally-closed tank contact. Actuator outputs are generated from the manifest; GPIO34/35/36/39 are input-only external-pull-up open-position contacts, GPIO33 is the NC safety auxiliary. No boot-strapping/flash GPIO is allocated as an output.

Four SPS30s share fixed I²C0x69: TCA9548A0x70 channels0–3 isolate them; the single SHT35-DIS0x44 uses channel4. SDP810-500Pa0x25 sits upstream. Only one mux channel is enabled at a time. SPS30 connector1=VDD5V,2=SDA,3=SCL,4=SEL grounded before startup,5=GND. All bus pull-ups are3.3V. A proposed4.7k upstream/downstream pull-up bank and10k mux RESET resistor are explicitly modeled; verify capacitance, rise time and pull-ups already fitted to carriers. I²C must remain local: full-scale remote PM boundary cables require a separately engineered differential link, not long unprotected I²C runs.

Proposed DFRobot SEN0483 speed and SEN0482 V2 vane use7–24V RS485/Modbus at9600 8N1, register0 divided by10. Factory address conflicts must be commissioned: speed2, vane3. MAX3485 is a3.3V reference transceiver. Termination, bias, surge protection, grounding/isolation and wind-from/toward orientation require site verification. The image's illustrative analog vane does not override this selected documented reference.

SEN0257 pressure is a proposed5V,0.5–4.5V reference with a mandatory10k/20k divider, clamp/RC conditioning and ADC calibration. Its delivered range/revision must be verified; firmware defaults to16bar full scale. The proposed SEN0217 flow family uses protected3.3V pulse conditioning;450pulses/L is a configurable calibration assumption. NC tank and emergency auxiliary contacts treat broken wires as unsafe. Never put raw5V/12V/24V signals or4–20mA directly on GPIO.

The protected driver assembly separates24V damper/valve channels,12V pump/fan branches and the galvanically isolated suction contactor interface. Inputs are proposed active-high3.3V with external fail-off pull-downs. Verify exact ordering codes, driver input thresholds, coil currents, flyback networks, switching ratings and inrush. Belimo LF24, Burkert6213 and SEAFLO33 are reference families, not finalized ordering codes. Browser travel is accelerated3s by default; physical firmware's75s feedback deadline is a commissioning setting, not a claim about every damper variant.

Pi5 uses a dedicated compatible5.1V/5A USB-C supply. Four SPS30s use the dedicated5V regulator rail. Proposed24V and12V supplies have separately sized loads and protected returns. A dual-rail hardware safety disconnect removes both actuator rails and drops the motor contactor independently of browser/Pi software. The protected mains interface and breaker are subsystem boundaries only. Qualified electrical design must determine protective earth, RCD/MCB coordination, fuse/current/wire ratings, overloads, enclosure and safe restart behavior. No mains-to-GPIO connection is proposed.

Primary references:

- [Sensirion SPS30 datasheet](https://sensirion.com/resource/datasheet/sps30)
- [TI TCA9548A datasheet](https://www.ti.com/lit/ds/symlink/tca9548a.pdf)
- [Espressif DevKitC V4 carrier/header guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
- [DFRobot SEN0483](https://wiki.dfrobot.com/sen0483/) and [SEN0482 V2](https://wiki.dfrobot.com/sen0482/)
- [DFRobot SEN0257](https://wiki.dfrobot.com/sen0257/) and [Sensirion SDP800 digital](https://sensirion.com/file/datasheet_sdp800-d/)
- [Mean Well LRS-150 reference](https://www.meanwell.com/Upload/PDF/LRS-150/LRS-150-SPEC.PDF)

## Firmware and Raspberry Pi application

The editor now shows actual `hardware/firmware/src/sensor.cpp`, `actuator.cpp`, `hardware/pi/app.py`, the shared protocol, hardware manifest and validated simulation JSON. The old two-PM/DHT Wokwi sketch is preserved for its existing demo but is not presented as final hardware firmware. Source edits are browser-local working copies; export them before compiling. Saving arbitrary C++/Python/TypeScript never silently executes it. Only validated Simulation Configuration JSON affects the browser model. The ZIP export is a real source archive for use in the existing repository, with firmware project, generated header, Wokwi setup, Pi application and protocol.

PlatformIO targets `sensor`, `actuator`, `sensor-sim`, `actuator-sim` use the same source files. Physical sensor firmware reads all four SPS30s with CRC/readiness checks, the single SHT35, Modbus wind, conditioned flow/pressure, NC tank contact and differential pressure. Acquisition timestamps follow completed reads. Actuator firmware uses structured commands, sequence/session checks, acknowledgement/status, external open feedback, NC stop, a2s heartbeat watchdog and safe-off outputs. The virtual variants replace peripheral acquisition/feedback with explicit injected models; they are not a different risk controller.

The hardware-independent Python host accepts validated NDJSON from replay, USB UART, local TCP tests, Wokwi RFC2217 or the local browser bridge. It computes deterministic risk/zone/transport decisions, requests feedback-confirmed suction and water-safe commands, checks ACK and telemetry timeouts, tracks causal history, calls the existing AI API and logs JSONL. Its risk/wind/transport port is checked against27 fixtures from the existing TypeScript modules. The trained model is not copied, reimplemented or retrained. Configuration is `hardware/pi/config.json`; physical ports and commissioning defaults must be selected. PC Python execution is not Pi hardware emulation.

Commands from the repository root:

```sh
python hardware/tools/generate.py --check
python -m pip install platformio==6.1.18 pyserial==3.5
python hardware/tools/build.py
python hardware/pi/app.py serve
```

The local bridge listens only on127.0.0.1:8010 with an explicit local frontend origin allowlist. Selecting **Local Python host** makes its returned commands drive the browser's virtual actuators; it does not open physical serial ports. The Build button requests a fixed checked-in-project build from this local service; edited working copies are never executed by that endpoint. Build output, errors and source/binary hashes are recorded. Source-hash mismatch clearly requires a fresh build; old binaries are not claimed to validate changed firmware.

Physical serial mode, after independent safety/bench validation and selecting the actual by-id ports:

```sh
python hardware/pi/app.py serial --sensor /dev/serial/by-id/SENSOR --actuator /dev/serial/by-id/ACTUATOR --arm
```

Host arm is sent only after valid sensor telemetry. Reconnection creates a new session and disables automatic re-arm; a fresh explicit operator start is required. Never use simulation firmware on physical actuators as a substitute for real feedback/safety inputs.

## Genuine external firmware execution workflow

ESP32 firmware cannot be executed by this webpage. The supported external route is Wokwi for VS Code or Wokwi CLI, using the supplied compiled ELF/bin references, diagrams and serial scenarios. An external Wokwi license/token is required; no token is requested or stored by the project. The environment used for this work had no Wokwi token, so an external emulator session is not claimed as tested execution.

1. Build the project with PlatformIO using the target commands above.
2. Open/select `hardware/firmware/wokwi-sensor/wokwi.toml` and the actuator equivalent in two external simulator sessions. Each references its real `sensor-sim`/`actuator-sim` ELF/bin.
3. The diagrams expose the controller and actuator GPIO indicators. The actuator diagram includes the independent stop switch. The automation YAML checks serial readiness, accepted commands, virtual open delay/GPIO, and watchdog shutdown. The sensor scenario injects independent readings and checks telemetry/timeout.
4. Wokwi VS Code RFC2217 ports are4001/4002. The Pi host can use `--sensor rfc2217://localhost:4001 --actuator rfc2217://localhost:4002`. With `--virtual-input telemetry.jsonl`, explicitly exported model telemetry is injected into the virtual sensor firmware once per second (last snapshot repeats). The firmware emits its own structured telemetry/timestamps; actuator ACK/status then come from executing firmware. These are distinct from the browser model's explicitly labeled ACKs.
5. Run CLI scenarios where an authorized Wokwi runtime is configured, for example `wokwi-cli hardware/firmware/wokwi-actuator --scenario scenario.yaml --timeout 15000`. Inspect actual runtime failures and GPIO output; never infer success merely from compilation.

References: [Wokwi project/serial configuration](https://docs.wokwi.com/vscode/project-config), [CLI requirements](https://docs.wokwi.com/wokwi-ci/cli-usage), [automation scenarios](https://docs.wokwi.com/wokwi-ci/automation-scenarios).

## AI provenance, faults and readiness

North SPS30 PM10 is the selected virtual history channel for the existing30s model contract.121 consecutive one-second snapshots provide120s of causal history; no prefill is invented. Missing data clears history. Model/artifact/time identities are verified. Inference failure is shown offline and retried. Earlier predictions appear beside actual later **virtual** North values only after target time arrives. Inputs are outside the model's validated laboratory domain; no new accuracy or physical transfer-validity is claimed. AI does not predict wind, zones, capture efficiency or lead time.

Faults cover disconnected/invalid PM, wind failure, communication/Pi heartbeat loss, stuck-closed/open damper, motor fault, HEPA blockage, pump/pressure faults, low water, stuck valve, power and emergency stop. Sensor failures conservatively inhibit suppression. Healthy dry/wet subsystems can remain available for localized faults. Stuck-open valves can remain physically indicated OPEN while their relay/pump is off; software cannot magically repair a jam. Communication faults and cleared emergency conditions require explicit re-arm. The browser's instantaneous spring-return safety closure is idealized; physical protection must be independent hardware.

Hardware Readiness lists every BOM item, power rail, source-verified compilation status, compatibility notes, calibration needs, interlock checks, assembly checklist and unverified ordering codes. No subsystem is marked hardware-tested. The BDT100,000–120,000 table is a planning allowance totalingBDT120,000, not current supplier quotes or a procurement guarantee. Confirm delivered parts/prices before purchasing.

Verification commands are `npm ci`, `npm test`, `npm run build`, `npm run test:hardware-python`, `npm run test:firmware`, and `npm run test:hardware-browser` with Playwright installed. Existing backend tests remain separate. See the repository validation report for actual results and any pending approval/runtime constraints.
