# DustTwin Hardware Simulator

Open `/hardware-simulator` in the existing DustTwin site. This is a deterministic functional logic simulator, not an electrical circuit solver, a firmware emulator, or a validated physical prototype. Existing pages and the trained model are preserved.

## Operation

Start runs a one-second virtual clock. Pause freezes travel and history while retaining actuator states. Resume continues. Step advances exactly one virtual second while paused. Reset restores defaults and clears history, faults, requests and outputs. Loading a scenario starts a fresh deterministic run; all fourteen presets change controller inputs, strategy or faults.

Automatic control reuses the existing weighted PM2.5 risk model and compass-to-zone rules. PM10 at or above 150 µg/m³ independently requests suppression; this is a demonstration setting, not a regulatory exposure limit. A/B/C/D correspond to North/East/South/West. Direction means **toward**, matching the existing simulator, rather than meteorological wind-from. Diagonal winds expose two boundaries. Strategy chooses dry extraction, water misting or both. The existing site-model transport lead is an uncalibrated deterministic estimate, not an AI threshold-crossing ETA.

Manual mode enables individual damper and valve requests plus independent motor and pump requests. Start or Step is still required. All safety interlocks remain active. Suction requires a nonzero open branch; pump requires an open valve. Changing mode clears manual requests. The 12V wind test fan is independently controlled; it does not change the wind-speed input.

Damper commands move estimated positions over configurable travel time. OPENING/CLOSING are visible before OPEN/CLOSED. No actual position-feedback device was specified. Nominal suction airflow is distributed in proportion to open branch fractions, capped by the modeled total; no measured fan curve or duct resistance is available. Existing project risk-based zone water flow is reused. Pump pressure is assumed 3 bar while operating. Cyclone efficiency, dust-bin fill, tank level, aerosol capture, electrical transients and CFD are not calculated. Virtual PM inputs remain user-controlled; the simulator does not claim a measured dust-removal efficiency. All six SPS30s share the common virtual PM input for repeatable tests; both SHT35s share the environment inputs.

## AI integration and measurement provenance

The browser collects **121 actual virtual-clock samples**, one per second, into the existing `/v1/predict` API request contract. No prefilled history is invented. After warm-up it requests inference every five virtual seconds using the existing model client, artifact verification, 30-second horizon and configured `VITE_DUSTTWIN_API_URL`. Backend failure displays unavailable and preserves deterministic controls. Offline requests retry on subsequent five-second intervals. Reset/scenario changes and sensor/power loss clear history and invalidate pending requests.

The trained PM10 model was validated on existing laboratory recordings, not these synthetic SPS30 inputs. Returned values are labeled model predictions on virtual input; no new accuracy or transfer-validity claim is made. Predictions display their issue/target times. No saved recording is substituted for virtual sensor inference. The existing API's OPC-N3 monitor/task identifiers are required schema identifiers, not a claim that virtual SPS30 readings are measured OPC-N3 data. AI PM10 is a separate monitoring output; this page's actuator decisions remain the explicit deterministic risk, PM10 setting and wind rules.

## Wiring reference and limitations

`src/features/hardware-simulator/hardware.ts` is the central component, pin, connection and actuator-GPIO mapping. Every rendered wire has an endpoint, named pin, signal/medium, voltage/interface description and purpose. Component selection highlights its connections; every connection is also accessible through the inspector. Air/water paths are explicitly distinguished from electrical wires. Subsystem filters and group collapsing reduce visual clutter. Electrical topology validation checks endpoints, direct GPIO driver bypass and unsafe GPIO input voltages; it is not an electrical-design certification.

This is a **proposed topology** for ESP32-WROOM-32 DevKit boards, not an assumed pinout for ESP32-C3/S3 or a WROVER. GPIO assignments avoid flash, boot-strapping and input-only output pins. GPIO34/35/36 are input-only conditioned ADC inputs, with external biasing where needed. Board carrier pin positions must be confirmed from the selected carrier schematic. Raspberry Pi 5 uses its own compatible 5.1V/5A USB-C supply, and both ESP32 boards use USB/UART bridges, including USB power and ground. Do not backfeed board power through an additional supply.

Six SPS30s have fixed I²C address 0x69. The added TCA9548A at 0x70 selects exactly **one** channel at a time: channels 0–5 serve North/East/South/West/source/background; channels 6–7 serve the two SHT35-DIS interfaces. SPS30 manufacturer connector numbers are 1 VDD, 2 SDA, 3 SCL, 4 SEL, 5 GND. Ground SEL before power-on for I²C, use a dedicated 5V sensor rail and 3.3V bus pull-ups at 100kHz. Pull mux RESET high and A0–A2 low. SHT35 carrier connectors remain unspecified; named signals are logical interfaces, not invented connector numbers. Keep I²C local. Full-scale boundary cable runs require a separately engineered differential/RS485 solution with transceivers, power, protection, protocol and termination; no such unselected hardware is implied by the diagram.

Anemometer, wind vane, water flow, water pressure and differential-pressure models have not been specified. Their proposed pulse/ADC inputs terminate in an abstract protected conditioning interface. Select the actual devices before choosing voltage scaling, calibration, field supplies or physical terminal assignments. Raw 5V/12V/24V or 4–20mA interfaces must not connect directly to GPIO.

Damper outputs assume low-voltage, spring-return, powered-open actuators. Reversible motors need different drivers. Pump, valves, relays, motor drivers/contactors, load rails, protection devices and connectors remain functional interfaces pending actual model/rating selection. The relay bank assumes compatible 3.3V active-high inputs, fail-off external pull-downs and protected load switching with DC flyback suppression. The fan has its own fused 12V supply. Common low-voltage reference is shown only where appropriate; galvanic separation is inside the rated contactor/driver interface.

220–240V is shown only through protected subsystem interfaces. No direct microcontroller-to-mains connection or exposed mains terminal routing is proposed. Certified supplies, fused branches, overloads, protective earth, RCDs, enclosure design and installation require an appropriate qualified electrical design. The independent NC emergency chain must remove actuator energy including the motor contactor regardless of host software; the browser models this behavior with an idealized immediate spring-return closure. Supply capacities, fuses, cable gauges and inrush budgets cannot be finalized until exact loads are selected.

Primary references:

- [Sensirion SPS30 datasheet](https://sensirion.com/resource/datasheet/sps30)
- [TI TCA9548A datasheet](https://www.ti.com/lit/ds/symlink/tca9548a.pdf)
- [Espressif ESP32 GPIO reference](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html)
- [Raspberry Pi power documentation](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#power-supply)

## Fault behavior

- North sensor disconnect: mark the channel unavailable; invalidate AI history and inhibit all suppression outputs conservatively.
- Damper A jam: FAULT, zero open fraction/airflow in A; healthy branches can operate.
- HEPA clog: differential pressure rises above the configured trip setting; dry extraction is inhibited, wet suppression remains available.
- Pump failure: pump off, zero flow/pressure, valves closed; dry extraction remains available.
- Emergency stop / power loss: all suppression outputs off, idealized spring-return closure. Test fan de-energizes. Power loss also clears forecast history.
- Clearing a fault re-evaluates current automatic or manual requests. In a real safety-rated installation, restart acknowledgement and independent safety circuitry must be engineered separately.

## Code workspace

The sensor tab shows the **actual legacy Wokwi sketch**, which uses two analog PM stand-ins and DHT, and is explicitly not six-SPS30 firmware. The actuator tab shows a new proposed eleven-output USB/UART scaffold with parser bounds, fail-off watchdog and basic mask interlocks. It is not compiled, flashed or executed by the site. The Pi tab shows the actual existing Python inference module, not an installed serial bridge. The shared-control tab shows the actual TypeScript engine used by the browser.

Editing source creates a browser-local working copy, saved under a versioned localStorage key or exported as individual files / a JSON bundle. Source changes do not dynamically execute, change repository files, or run arbitrary C++/Python/TypeScript. Only validated Simulation Configuration JSON applies to the running logic. Corrupt storage falls back to project defaults. Reset file restores its original source; simulator Reset restores runtime configuration independently. Save applies the configuration copy; file copies remain available after reload.

The proposed actuator scaffold shares the central mapping by an automated consistency check, accepts `SET <decimal bitmask>` or `STOP` over 115200 baud USB UART, and fails off after 1500ms without valid commands. Bits 0–3 are dampers A–D; 4–7 valves A–D; 8 pump; 9 suction contactor; 10 fan. This is a reviewable starting point, not a deployable complete hybrid firmware suite. A production sensor controller, host serial bridge, hardware feedback, calibration, heartbeat/fault protocol and independent safety validation remain physical-integration work.

## Verification

Run `npm ci`, `npm test` and `npm run build` (use `npm.cmd` in PowerShell if execution policy blocks the wrapper). Tests cover inventory, wire validation, all scenarios, sensor-to-controller decisions, controller-to-actuator behavior, travel, pause/step/reset, manual interlocks, faults, causal AI history, configuration and bounded event logging. Backend tests can run with `ai-backend/.venv/Scripts/python.exe -m unittest discover -s ai-backend/tests` on Windows. The browser QA script at `tests/browser/hardware-smoke.cjs` exercises controls, code persistence/export, real AI response, all existing routes and mobile overflow when Playwright and the local frontend/backend servers are available.
