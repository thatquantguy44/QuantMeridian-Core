#!/usr/bin/env bash
# QuantSmith pin checks (spec005 record, spec009 content pin).
#
# 1. BLOCKING (exit 1): docs/specs/spec005/QUANTSMITH_PIN.md and
#    contracts/agent/quantsmith-pin.json must agree on the package version and both digests.
#    Needs no QuantSmith copy, so it runs in hosted CI.
# 2. ADVISORY (never fails): when a local QuantSmith copy is found, its fingerprints are computed
#    with services/agent_worker/src/agent_worker/pin.py and drift from the pin is reported. The
#    copy is selected by $QUANTSMITH_ROOT (also read from .env), then reviewed.source_path.
#    Without either, legacy default paths are probed. An explicit missing path never falls back.
#    No network call is ever made; Git metadata is optional and informational.
#
# QuantSmith's own hooks/stages/quantsmith-version-check.sh gate cannot run here: it looks for a
# `quantsmith==X.Y.Z` pin in requirements.txt/pyproject.toml and an importable package, neither of
# which exists in this Node/Vite repo (spec 0047, RISK-004).

set -uo pipefail

PIN_FILE="docs/specs/spec005/QUANTSMITH_PIN.md"
PIN_JSON="contracts/agent/quantsmith-pin.json"
PIN_TOOL="services/agent_worker/src/agent_worker/pin.py"
OLD_DEFAULT_DIR="../agentic_workflows/qf_workflow_sdk_public"

if [[ ! -f "$PIN_FILE" ]]; then
  echo "QuantSmith pin check: $PIN_FILE not found, skipped."
  exit 0
fi

# --- 1. record <-> JSON agreement (blocking) ---------------------------------------------------

record_field() { # value of a `| <label> | ... |` row, first backtick-quoted token
  grep -m1 -E "^\| $1 \|" "$PIN_FILE" | sed -E 's/^[^`]*`([^`]*)`.*/\1/'
}

if [[ ! -f "$PIN_JSON" ]]; then
  echo "QuantSmith pin check FAILED — $PIN_JSON is missing."
  exit 1
fi

json_field() {
  python3 -c '
import json, sys
pin = json.load(open(sys.argv[1]))
path = sys.argv[2].split(".")
for key in path:
    pin = pin.get(key) if isinstance(pin, dict) else None
print("" if pin is None else pin)' "$PIN_JSON" "$1"
}

status=0
check_pair() { # label, record value, json value
  if [[ -z "$2" ]]; then
    echo "  MISMATCH $1: not found in $PIN_FILE"
    status=1
  elif [[ "$2" != "$3" ]]; then
    echo "  MISMATCH $1: record=$2 json=$3"
    status=1
  fi
}

check_pair "package version" "$(record_field 'Package version')" "$(json_field package.version)"
check_pair "code digest" "$(record_field 'Code digest')" "$(json_field package.code_digest)"
check_pair "assets digest" "$(record_field 'Assets digest')" "$(json_field assets.digest)"
reviewed_commit=$(json_field reviewed.source_commit)
reviewed_path=$(json_field reviewed.source_path)
if [[ -n "$reviewed_commit" ]]; then
  check_pair "reviewed commit" "$(record_field 'Reviewed commit \(informational\)')" "$reviewed_commit"
elif [[ -z "${reviewed_path//[[:space:]]/}" ]]; then
  echo "  MISMATCH reviewed source: provide source_commit or a non-blank source_path"
  status=1
fi

if [[ $status -ne 0 ]]; then
  echo "QuantSmith pin check FAILED — $PIN_FILE and $PIN_JSON disagree. Update them together."
  exit 1
fi
echo "QuantSmith pin record PASSED — $PIN_FILE and $PIN_JSON agree."

# --- 2. local copy drift (advisory) ------------------------------------------------------------

root="${QUANTSMITH_ROOT:-}"
if [[ -z "$root" && -f .env ]]; then
  root=$(grep -E '^QUANTSMITH_ROOT=' .env | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']|["'\'']$//g')
fi
if [[ -z "$root" ]]; then
  root="$reviewed_path"
fi

copy="$root"
if [[ -z "$copy" ]]; then
  for candidate in "$OLD_DEFAULT_DIR" "../QuantSmith"; do
    if [[ -d "$candidate/src/quantsmith" ]]; then
      copy="$candidate"
      break
    fi
  done
fi

if [[ -z "$copy" ]]; then
  echo "QuantSmith copy drift: no local copy configured/found (QUANTSMITH_ROOT, reviewed.source_path, $OLD_DEFAULT_DIR, ../QuantSmith), skipped."
  exit 0
fi

echo "QuantSmith copy drift: checking $copy"
if ! command -v python3 >/dev/null 2>&1; then
  echo "  python3 not found, skipped."
  exit 0
fi

if report=$(python3 -I "$PIN_TOOL" --root "$copy" 2>&1); then
  mismatches=$(printf '%s' "$report" | python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin)["mismatches"]))')
  if [[ -z "$mismatches" ]]; then
    echo "  PASSED — code and assets digests match the pin."
  else
    echo "  DRIFT — fingerprints differ from the pin ($mismatches)."
    echo "  Strict fingerprint verification fails for this copy until it is reviewed and re-pinned"
    echo "  (see docs/specs/spec005/QUANTSMITH_PIN.md)."
  fi
else
  echo "  could not fingerprint the copy: $report"
fi

# Informational only: where the copy's git HEAD stands against the recorded commits.
if [[ -n "$reviewed_commit" && -e "$copy/.git" ]]; then
  head=$(git -C "$copy" rev-parse HEAD 2>/dev/null || true)
  if [[ -n "$head" ]]; then
    if [[ "$head" == "$reviewed_commit" ]]; then
      echo "  git HEAD is the spec009 reviewed commit ($head)."
    else
      echo "  git HEAD $head differs from the spec009 reviewed commit $reviewed_commit (information only)."
    fi
  fi
fi

exit 0
