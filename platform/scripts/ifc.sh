#!/usr/bin/env bash
# Generate a project IFC from its compiled guide, then check it against the compiled data and IDS.
#
# Run from anywhere; paths resolve from the platform root.
#   bash scripts/ifc.sh [slug] [evidence-dir]
#
# Defaults: slug=p0-fixture; evidence-dir=work/3d-platform/evidence/<tag>/bim/run-1 where tag is
# p0 for p0-fixture, r35 for pantry-r35, otherwise the slug itself.
#
# Artifacts:
#   apps/guide-site/public/data/releases/<slug>/<releaseId>/model/project.ifc
#   <evidence-dir>/ifc-generate.json
#   <evidence-dir>/check-report.json
#
# Exit codes: 0 = generated and checked, 1 = a real check failed, 2 = not_run (venv, catalog,
# compiled data or IDS missing). "not_run" is printed with the reason; it is never reported as a
# pass. The check uses the frozen control-point oracle for p0-fixture and a deterministic derived
# oracle for every other project (tools/ifc/check_ifc.py --slug).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "${here}/.." && pwd)"
slug="${1:-p0-fixture}"
venv_python="${root}/.venv-ifc/bin/python"

if [[ -n "${2:-}" ]]; then
  evidence_dir="$2"
else
  case "${slug}" in
    p0-fixture) evidence_tag="p0" ;;
    pantry-r35) evidence_tag="r35" ;;
    *) evidence_tag="${slug}" ;;
  esac
  evidence_dir="${root}/work/3d-platform/evidence/${evidence_tag}/bim/run-1"
fi

if [[ ! -x "${venv_python}" ]]; then
  echo "not_run: ${venv_python} is missing; run 'bash tools/ifc/setup.sh' with PyPI access." >&2
  exit 2
fi

if ! "${venv_python}" -c "import ifcopenshell, ifctester" >/dev/null 2>&1; then
  echo "not_run: .venv-ifc exists but ifcopenshell/ifctester do not import; reinstall per tools/ifc/requirements.txt." >&2
  exit 2
fi

catalog="${root}/apps/guide-site/public/data/catalog.json"
if [[ ! -f "${catalog}" ]]; then
  echo "not_run: ${catalog} is missing; run 'npm run data' before 'bash scripts/ifc.sh'." >&2
  exit 2
fi

selection="$("${venv_python}" - "${catalog}" "${slug}" <<'PY'
import json
import sys

catalog = json.load(open(sys.argv[1], encoding="utf-8"))
wanted = sys.argv[2]
entries = catalog.get("entries") or []
entry = next((candidate for candidate in entries if candidate.get("slug") == wanted), None)
if entry is None:
    raise SystemExit(
        "catalog has no entry for slug {!r}; found {}".format(
            wanted, [candidate.get("slug") for candidate in entries]
        )
    )
print(entry["slug"])
print(entry["releaseId"])
PY
)"
slug="$(printf '%s\n' "${selection}" | sed -n '1p')"
release_id="$(printf '%s\n' "${selection}" | sed -n '2p')"
compiled="${root}/apps/guide-site/public/data/releases/${slug}/${release_id}/guide.compiled.json"
model_dir="${root}/apps/guide-site/public/data/releases/${slug}/${release_id}/model"

ids=""
ids_matches=("${root}/projects/${slug}"/*/model/project.ids)
if [[ ${#ids_matches[@]} -eq 1 && -f "${ids_matches[0]}" ]]; then
  ids="${ids_matches[0]}"
fi

if [[ ! -f "${compiled}" ]]; then
  echo "not_run: ${compiled} is missing; run 'npm run data' first." >&2
  exit 2
fi
if [[ -z "${ids}" ]]; then
  echo "not_run: no IDS found at projects/${slug}/*/model/project.ids; author it first." >&2
  exit 2
fi

mkdir -p "${evidence_dir}"
echo "ifc.sh: slug=${slug} releaseId=${release_id}"
echo "ifc.sh: setup check"
bash "${root}/tools/ifc/setup.sh"

echo "ifc.sh: generate ${model_dir}/project.ifc"
"${venv_python}" "${root}/tools/ifc/generate_ifc.py" \
  --compiled "${compiled}" \
  --out "${model_dir}/project.ifc" | tee "${evidence_dir}/ifc-generate.json"

echo "ifc.sh: check"
"${venv_python}" "${root}/tools/ifc/check_ifc.py" \
  --ifc "${model_dir}/project.ifc" \
  --compiled "${compiled}" \
  --ids "${ids}" \
  --slug "${slug}" \
  --report "${evidence_dir}/check-report.json"

echo "ifc.sh: OK"
