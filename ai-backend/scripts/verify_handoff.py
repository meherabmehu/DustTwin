"""Verify the unchanged upstream files, including the included model binary."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    manifest = json.loads((ROOT / "models/upstream-provenance.json").read_text())
    files = manifest["unchanged_upstream_files"]
    for item in files:
        path = ROOT / item["path"]
        body = path.read_bytes()
        if len(body) != item["bytes"] or hashlib.sha256(body).hexdigest() != item["sha256"]:
            raise ValueError(f"Upstream asset changed: {item['path']}")
    print(json.dumps({"unchanged_upstream_files": len(files), "sha256_and_sizes": "passed",
                      "upstream_commit": manifest["upstream_commit"]}))


if __name__ == "__main__":
    main()
