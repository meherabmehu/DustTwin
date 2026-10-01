"""Read checksum-verified OPC-N3 source files without using rolling means."""

from __future__ import annotations

import csv
from datetime import datetime, timedelta, time
import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
from zipfile import ZipFile

PM_COLUMNS = ("PM1(ug/m3)", "PM2.5(ug/m3)", "PM10(ug/m3)")
CONTEXT_COLUMNS = ("Temperature(C)", "RelativeHumidity(%)", "SamplingPeriod(s)", "SFR(ml/s)")


def raw_profiles(root: Path) -> tuple[list[dict], list[tuple[str, bytes]]]:
    """Read the pinned nested archive in memory; never extract arbitrary paths."""
    config = json.loads((root / "configs/datasets.json").read_text())
    dataset = next(d for d in config["datasets"] if d["id"] == "7f22n9v7hp")
    expected = dataset["files"][0]
    source = root / "data/raw/mendeley-7f22n9v7hp-v1" / expected["filename"]
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected["sha256"]:
        raise ValueError("Archive hash does not match the pinned original")
    with ZipFile(source) as outer:
        members = [m for m in outer.infolist() if not m.is_dir()]
        if len(members) != 1 or not members[0].filename.endswith("/Data.zip"):
            raise ValueError("Unexpected outer archive structure")
        with ZipFile(BytesIO(outer.read(members[0]))) as archive:
            inventory = [{"path": m.filename, "size_bytes": m.file_size,
                          "sha256": hashlib.sha256(archive.read(m)).hexdigest()}
                         for m in archive.infolist() if not m.is_dir()]
            selected = [(m.filename, archive.read(m)) for m in archive.infolist()
                        if not m.is_dir() and "/raw" in m.filename.lower()
                        and m.filename.lower().endswith(".csv")
                        and "opc" in Path(m.filename).name.lower()]
    return inventory, selected


def decode_clock(value: str) -> tuple[float, str, str | None]:
    """Return seconds, clock type and known date without inventing missing dates."""
    try:
        days = float(value)
    except ValueError:
        clock = time.fromisoformat(value.strip())
        seconds = clock.hour * 3600 + clock.minute * 60 + clock.second + clock.microsecond / 1e6
        return seconds, "time_of_day_no_date", None
    if days < 20000:
        raise ValueError("Unexpected OLE Automation date")
    seconds = days * 86400
    date = (datetime(1899, 12, 30) + timedelta(days=days)).date().isoformat()
    return seconds, "ole_automation_datetime_no_timezone", date


def read_opc(path: str, body: bytes) -> dict:
    """Preserve file order, duplicates and raw timestamps for the quality audit."""
    lines = body.decode("utf-8-sig").splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("OADateTime,"))
    reader = csv.DictReader(lines[start:])
    headers = reader.fieldnames
    required = ("OADateTime",) + PM_COLUMNS + CONTEXT_COLUMNS
    if any(column not in headers for column in required):
        raise ValueError(f"Missing OPC fields in {path}")
    values = {column: [] for column in required}
    clocks, dates, clock_types = [], set(), set()
    for row in reader:
        if not any(row.values()):
            continue
        stamp, clock_type, date = decode_clock(row["OADateTime"])
        clocks.append(stamp)
        clock_types.add(clock_type)
        if date:
            dates.add(date)
        values["OADateTime"].append(row["OADateTime"])
        for column in PM_COLUMNS + CONTEXT_COLUMNS:
            value = row[column].strip()
            values[column].append(float(value) if value else None)
    if len(clock_types) != 1:
        raise ValueError(f"Mixed clock representations in {path}")
    laboratory = re.search(r"/Experiment (\d+)/(\d+) sec drilling/", path)
    outdoor = re.search(r"/Day (\d+)/", path)
    if laboratory:
        group, drilling = map(int, laboratory.groups())
        episode = f"lab_e{group}_drill{drilling}"
        environment = "laboratory"
    elif outdoor:
        group, drilling = int(outdoor.group(1)), None
        episode, environment = f"outdoor_day{group}", "outdoor"
    else:
        raise ValueError(f"Unknown experiment identity in {path}")
    return {"episode_id": episode, "environment": environment, "group": group,
            "drilling_duration_label_seconds": drilling, "archive_path": path,
            "sha256": hashlib.sha256(body).hexdigest(), "headers": headers,
            "clock_type": next(iter(clock_types)), "known_dates": sorted(dates),
            "clock_seconds": clocks, "values": values}
