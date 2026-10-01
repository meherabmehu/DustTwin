"""Acquire pinned public Mendeley files and record verified local provenance.

Uses the anonymous public endpoint used by Mendeley's dataset page. Requires
Python 3.12+ and curl. Original files are never altered or committed.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlencode, urlparse

ROOT = Path(__file__).resolve().parents[1]


def curl(url: str, output: Path) -> None:
    subprocess.run(
        [
            "curl", "--silent", "--show-error", "--location", "--fail",
            "--retry", "2", "--connect-timeout", "20", "--max-time", "300", "--proto", "=https",
            "--proto-redir", "=https", "--user-agent", "Mozilla/5.0",
            "--header", "Accept: application/vnd.mendeley-public-dataset.1+json",
            "--output", str(output), url,
        ],
        check=True,
    )


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def acquire(dataset: dict) -> dict:
    key = f"mendeley-{dataset['id']}-v{dataset['version']}"
    destination = ROOT / "data" / "raw" / key
    destination.mkdir(parents=True, exist_ok=True)
    query = urlencode({"folder_id": "root", "version": dataset["version"],
                       "$start": 0, "$limit": 1000})
    endpoint = f"https://data.mendeley.com/public-api/datasets/{dataset['id']}/files?{query}"
    verified = []
    with tempfile.TemporaryDirectory(dir=destination) as temporary:
        directory = Path(temporary)
        listing = directory / "files.json"
        curl(endpoint, listing)
        public_files = json.loads(listing.read_text())
        by_id = {file["id"]: file for file in public_files}
        for expected in dataset["files"]:
            file = by_id[expected["id"]]
            details = file["content_details"]
            require(file["filename"] == expected["filename"], "Filename changed")
            require(details["size"] == expected["size_bytes"], "Published size changed")
            require(details["sha256_hash"] == expected["sha256"], "Published hash changed")
            filename = expected["filename"]
            require(Path(filename).name == filename, "Unsafe filename")
            url = details["download_url"]
            parsed = urlparse(url)
            require(parsed.scheme == "https" and parsed.hostname == "data.mendeley.com", "Unexpected download host")
            local = destination / filename
            cached = (local.exists() and local.stat().st_size == expected["size_bytes"]
                      and sha256(local) == expected["sha256"])
            if not cached:
                pending = directory / filename
                print(f"Downloading {key}/{filename}", flush=True)
                curl(url, pending)
                require(pending.stat().st_size == expected["size_bytes"], "Download size mismatch")
                require(sha256(pending) == expected["sha256"], "Download hash mismatch")
                pending.replace(local)
            print(f"Verified {key}/{filename}: {local.stat().st_size} bytes")
            verified.append({**expected, "download_url": url,
                             "local_path": str(local.relative_to(ROOT)),
                             "verified_sha256": sha256(local)})
    return {
        "key": key,
        **{field: dataset[field] for field in
           ("id", "version", "title", "contributors", "doi", "source_url",
            "license", "license_url")},
        "accessed_at_utc": datetime.now(timezone.utc).isoformat(),
        "listing_url": endpoint,
        "files": verified,
        "alterations_to_original_files": "none",
        "reuse_note": "Attribute the contributors and DOI, link the license, and identify derived changes.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", help="Pinned dataset ID; default acquires all configured datasets")
    args = parser.parse_args()
    config = json.loads((ROOT / "configs/datasets.json").read_text())
    selected = [d for d in config["datasets"] if args.dataset in (None, d["id"])]
    if not selected:
        parser.error("Dataset is not pinned in configs/datasets.json")
    manifest_path = ROOT / "data/manifest.json"
    manifest = (json.loads(manifest_path.read_text()) if manifest_path.exists()
                else {"schema_version": 1, "datasets": []})
    entries = {d["key"]: d for d in manifest["datasets"]}
    for dataset in selected:
        acquired = acquire(dataset)
        old = entries.get(acquired["key"])
        if old:
            acquired["accessed_at_utc"] = old["accessed_at_utc"]
        entries[acquired["key"]] = acquired
    manifest["datasets"] = [entries[key] for key in sorted(entries)]
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Manifest: {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
