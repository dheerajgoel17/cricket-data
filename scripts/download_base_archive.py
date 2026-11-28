"""Fetch and validate the full Base archive before publishing it to a workflow cache."""

import shutil
import sys
from pathlib import Path

from cricket_data.cricsheet import download


def main() -> None:
    target = Path(sys.argv[1])
    target.parent.mkdir(parents=True, exist_ok=True)
    archive = download("all_json.zip", retries=4, backoff=20)
    try:
        shutil.move(archive, target)
    finally:
        archive.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
