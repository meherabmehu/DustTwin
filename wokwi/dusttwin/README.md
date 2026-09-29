# DustTwin Wokwi hardware demo

This directory contains the source files for the DustTwin ESP32 demonstration used by the embedded simulator on `/circuit-simulation`.

- `diagram.json` describes the Wokwi board and virtual circuit.
- `sketch.ino` contains ESP32 Arduino firmware.
- `libraries.txt` lists the Wokwi Arduino library dependency.

The physical PMS5003 parts are not modeled by Wokwi. Two potentiometers will be used as adjustable analog PM concentration inputs. Wokwi's single-channel relay module will represent each misting zone, and indicator LEDs will represent zone, pump, and fan outputs. The DHT22 is simulated directly and its temperature/humidity values can be adjusted in the Wokwi UI.

The public project URL and project ID are configured centrally in `src/config/simulation.ts` after the Wokwi project is saved.
