#!/usr/bin/env bash
# Ensure the local IfcOpenShell venv exists at platform/.venv-ifc.
#
# Rules (packet D): never recreate an existing venv, never make a network call when the venv is
# already usable. Creating a missing venv needs PyPI access; if that is unavailable the script
# exits non-zero and prints "not_run" so gate:docs/gate:p0 can report the real cause instead of a
# silent pass.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
platform_root="$(cd "${here}/../.." && pwd)"
venv="${platform_root}/.venv-ifc"
python_bin="${venv}/bin/python"

if [[ ! -x "${python_bin}" ]]; then
  echo "not_run: ${venv} is missing; creating it now (requires PyPI access)."
  python3 -m venv "${venv}"
  "${python_bin}" -m pip install --disable-pip-version-check -r "${here}/requirements.txt"
fi

"${python_bin}" - <<'PY'
import importlib.metadata as md
import sys
try:
    import ifcopenshell
    import ifctester
except Exception as error:  # pragma: no cover - defensive path
    print(f"not_run: IfcOpenShell imports failed: {error}", file=sys.stderr)
    raise SystemExit(2)
versions = {
    "ifcopenshell": md.version("ifcopenshell"),
    "ifctester": md.version("ifctester"),
}
print(f"ifc venv ok: ifcopenshell {versions['ifcopenshell']} / ifctester {versions['ifctester']}")
PY
