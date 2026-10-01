"""Start the model API for a separately maintained frontend."""

import argparse
import os
from pathlib import Path
import sys

import uvicorn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/inference"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument(
        "--origins",
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        help="Allowed CORS origins (comma-separated)",
    )
    args = parser.parse_args()

    if "DUSTTWIN_ALLOWED_ORIGINS" not in os.environ:
        os.environ["DUSTTWIN_ALLOWED_ORIGINS"] = args.origins

    uvicorn.run("app:app", host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
