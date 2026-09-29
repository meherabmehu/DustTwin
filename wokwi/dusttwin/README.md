# DustTwin Wokwi demo

A deterministic ESP32 demonstration of DustTwin's threshold-based boundary-dust response. The sketch starts in **AUTO** mode; it does not train or use an ML model. Thresholds in this demo are illustrative and are not validated exposure or safety limits.

## Simulated hardware

| Wokwi part | Role in the tabletop prototype | Connection |
| --- | --- | --- |
| ESP32 DevKit V1 | Reads sensors and switches control outputs | Main controller |
| DHT22 | Ambient temperature and humidity | GPIO 15 |
| Potentiometer labeled PM Sensor 1 | Simulated PMS5003 boundary reading | GPIO 34 / ADC1 |
| Potentiometer labeled PM Sensor 2 | Simulated PMS5003 boundary reading | GPIO 35 / ADC1 |
| Four relay modules | Switch the four separate misting-zone circuits | GPIOs 18, 19, 21, 22 |
| Four green LEDs | Visible Zone 1–4 indicators | GPIOs 13, 14, 27, 32 |
| Blue LED | Water-pump output indicator (visual substitute) | GPIO 25 |
| Orange LED | Fan output indicator (visual substitute) | GPIO 26 |

The LEDs stand in for the prototype's pump and fan loads; this simulation does not actuate real equipment. The relay modules demonstrate the four switched zone outputs.

## Automatic behavior

- Each potentiometer simulates a PM reading from 0 to approximately 150 µg/m³.
- At **40 µg/m³** or above, the corresponding side's first zone is enabled.
- At **75 µg/m³** or above, both zones on that side are enabled and the fan indicator turns on.
- The pump indicator is on whenever any misting zone is active.
- Sensor 1 maps to Zones 1–2; Sensor 2 maps to Zones 3–4.

These are demonstration values only; calibrate any real system using appropriate site measurements and validated operating limits.

## Manual test commands

The serial terminal accepts one-character commands (press Enter after typing):

- `A` — return to automatic control.
- `M` — enter manual/test mode.
- `1`, `2`, `3`, `4` — toggle the corresponding zone in manual mode.
- `0` — turn off all zones and the fan in manual mode.
- `F` — toggle the fan indicator in manual mode.

The serial terminal prints PM inputs, DHT22 readings, boundary risk, predicted zones, and each output state every two seconds.

## Local files

- `diagram.json` — Wokwi circuit, wiring, part labels, and serial terminal settings.
- `sketch.ino` — ESP32 control sketch.
- `libraries.txt` — Wokwi Arduino library dependency.
- `wokwi.toml` — local Wokwi CLI project configuration.
