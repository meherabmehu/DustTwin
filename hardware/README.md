# DustTwin physical/virtual hardware project

This project extends the existing Hardware Simulator. Current inventory is four SPS30 boundary sensors and one SHT35; earlier six-sensor examples are superseded.

- Authority: `manifest.json` and `protocol.schema.json`.
- Generate/check pin header and downloadable wiring CSV: `python hardware/tools/generate.py [--check]`.
- Firmware: `firmware/platformio.ini` defines sensor, actuator and explicit virtual-peripheral targets. `python hardware/tools/build.py` records real compiler results and source/binary hashes.
- Host: `python hardware/pi/app.py serve` runs the local browser/Python bridge. `replay --file telemetry.jsonl` consumes exported protocol input. `serial --sensor PORT --actuator PORT --arm` requires deliberate physical commissioning.
- External execution: Wokwi project folders contain ELF/bin references, diagrams and automation scenarios. Virtual sensor input is explicit; the browser does not execute ESP32 firmware.
- Tests: `python -m unittest discover -s hardware/tests`; frontend/geometry/protocol tests run through the repository's `npm test`.

The full model, safety limits, selected references, real serial/RFC2217 setup and assembly requirements are documented in `public/docs/hardware-simulator.md`. Exported project ZIPs belong inside an existing DustTwin checkout so the unchanged AI backend/model remains available. No current source is hardware-tested or certified as an electrical schematic.
