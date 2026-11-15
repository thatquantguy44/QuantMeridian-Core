"""Exercise an extracted wheel in a clean environment without this repository."""

import shutil
import subprocess
import sys
import tempfile
import unittest
import venv
from pathlib import Path


class ModelPortabilityTest(unittest.TestCase):
    def test_extracted_wheel_imports_without_the_checkout_or_api_dependencies(self):
        project = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="pora-model-") as temporary:
            workspace = Path(temporary)
            extracted = workspace / "extracted-model"
            shutil.copytree(
                project,
                extracted,
                ignore=shutil.ignore_patterns(
                    ".venv",
                    "__pycache__",
                    "*.egg-info",
                    "build",
                    "dist",
                    ".pytest_cache",
                ),
            )
            wheels = workspace / "wheels"
            self.run_command(
                sys.executable,
                "-m",
                "pip",
                "--isolated",
                "wheel",
                "--no-index",
                "--no-deps",
                "--no-build-isolation",
                "--wheel-dir",
                str(wheels),
                str(extracted),
                cwd=workspace,
            )
            (wheel,) = wheels.glob("portfolio_regime_models-*.whl")
            venv.EnvBuilder(with_pip=True).create(workspace / "venv")
            python = (
                workspace
                / "venv"
                / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
            )
            self.run_command(
                str(python),
                "-m",
                "pip",
                "--isolated",
                "install",
                "--no-index",
                "--no-deps",
                str(wheel),
                cwd=workspace,
            )
            shutil.rmtree(extracted)
            self.run_command(
                str(python),
                "-I",
                "-c",
                "import importlib.metadata as m, importlib.util as u; "
                "import portfolio_regime_models as model; "
                "assert model.__version__ == m.version('portfolio-regime-models'); "
                "assert not m.requires('portfolio-regime-models'); "
                "assert u.find_spec('fastapi') is None; "
                "assert u.find_spec('portfolio_regime_api') is None",
                cwd=workspace,
            )

    def run_command(self, *command: str, cwd: Path):
        completed = subprocess.run(
            command, cwd=cwd, capture_output=True, text=True, timeout=120, check=False
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)


if __name__ == "__main__":
    unittest.main()
