#!/usr/bin/env python3
"""Regenerate the tiny synthetic dataset the site's JS tests run on: site/tests/fixtures/data + expectations.json.

    python scripts/make_site_fixture.py

The numbers in expectations.json are computed straight from the scripted stats in tests/site/synth.py, independently of the
parser, so the JS engine tests check real arithmetic rather than echoing the build.
"""
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "tests" / "site")]

import synth  # noqa: E402

from cricket_site import build  # noqa: E402

OUT = ROOT / "site" / "tests" / "fixtures"


def generate(out: Path) -> dict:
    docs, exp = synth.make_dataset()
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        z = synth.write_zip(docs, tmp / "all_json.zip")
        data = tmp / "data"
        (data / "provisional").mkdir(parents=True)
        build.build(z, data, out / "data", None, workers=1)
    exp["ids"] = {"brook": synth.pid(synth.BROOK), "duckett": synth.pid(synth.DUCKETT), "kohli": synth.pid(synth.KOHLI)}
    (out / "expectations.json").write_text(json.dumps(exp, indent=1) + "\n", encoding="utf-8")
    return exp


if __name__ == "__main__":
    generate(OUT)
    print(f"wrote {OUT}")
