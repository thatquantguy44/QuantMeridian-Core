"""End-to-end checks for the CSV reproduction command using public Gold excerpts."""

import csv
import json
import tempfile
import unittest
from pathlib import Path

from vixr_reproduce import report


ROOT = Path(__file__).resolve().parents[2] / "src/lib/__fixtures__/vixr"


def write_csv(path: Path, header: str, rows: list) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("date", header))
        writer.writerows(rows)


class ReproduceTest(unittest.TestCase):
    def test_public_excerpts_match_independent_golden_summaries(self) -> None:
        for name in ("crisis_2007_2009", "calm_2017"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                raw = json.loads((ROOT / f"gold-{name}.json").read_text())
                expected = json.loads((ROOT / f"expected-{name}.json").read_text())
                vix_path, spy_path = Path(directory) / "vix.csv", Path(directory) / "spy.csv"
                write_csv(vix_path, "vix", raw["vix"])
                write_csv(spy_path, "close", raw["spy"])
                result = report(vix_path, spy_path, raw["spy"][-1][0])
                for key, golden in (("daily", expected["daily"]), ("non_overlapping", expected["monthly"])):
                    observed = result[key]
                    self.assertEqual(observed["n"], golden["n"])
                    self.assertAlmostEqual(observed["within1"]["pct"], golden["within1"]["pct"])
                    self.assertAlmostEqual(observed["volRatio"], golden["volRatio"])
                    self.assertAlmostEqual(observed["returnOnVix"]["r2"], golden["returnOnVix"]["r2"])

    def test_cutoff_excludes_later_observations(self) -> None:
        raw = json.loads((ROOT / "gold-crisis_2007_2009.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            vix_path, spy_path = Path(directory) / "vix.csv", Path(directory) / "spy.csv"
            write_csv(vix_path, "vix", raw["vix"])
            write_csv(spy_path, "close", raw["spy"])
            result = report(vix_path, spy_path, "2008-12-31")
            self.assertLessEqual(result["inputs"]["vix_last"], "2008-12-31")
            self.assertLessEqual(result["inputs"]["spy_last"], "2008-12-31")
            self.assertLess(result["daily"]["n"], len(raw["vix"]))

    def test_duplicate_date_is_rejected(self) -> None:
        raw = json.loads((ROOT / "gold-calm_2017.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            vix_path, spy_path = Path(directory) / "vix.csv", Path(directory) / "spy.csv"
            write_csv(vix_path, "vix", raw["vix"][:30] + raw["vix"][29:30])
            write_csv(spy_path, "close", raw["spy"])
            with self.assertRaisesRegex(ValueError, "unique and ascending"):
                report(vix_path, spy_path, "2017-12-31")


if __name__ == "__main__":
    unittest.main()
