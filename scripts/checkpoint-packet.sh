#!/usr/bin/env bash
# checkpoint-packet: the compact "verify before reporting" packet.
#
# Composes the read-only helpers into one markdown checkpoint a human reviews at
# a slice/arc boundary: where we are (status-snapshot), what proof this branch
# owes (branch-risk vs dev), and the behaviour evidence (digest of a Hell Week
# run, if one is supplied). Read-only; assembles existing typed outputs, never
# touches evidence.json transcripts.
#
# Usage: scripts/checkpoint-packet.sh [run-dir-or-report.json] [--base <ref>]
set -euo pipefail

run_dir=""
base="dev"
while [ $# -gt 0 ]; do
  case "$1" in
    --) shift ;;
    --base) base="${2:?--base needs a ref}"; shift 2 ;;
    --*) echo "checkpoint-packet: unknown flag: $1" >&2; exit 2 ;;
    *) if [ -z "$run_dir" ]; then run_dir="$1"; shift; else echo "checkpoint-packet: unexpected arg: $1" >&2; exit 2; fi ;;
  esac
done

echo "# Checkpoint packet"
echo
bash scripts/status-snapshot.sh
echo
npm --silent run branch-risk -- --base "$base"
echo
echo "## evidence"
if [ -n "$run_dir" ]; then
  npm --silent run digest -- "$run_dir"
else
  echo "- no run supplied. Attach a Hell Week run for behaviour proof:"
  echo "  just checkpoint-packet -- <run-dir>"
  if [ -f artifacts/evidence-index/floor-delta-latest.json ]; then
    status="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync("artifacts/evidence-index/floor-delta-latest.json","utf8")).status)' 2>/dev/null || echo unknown)"
    echo "- latest floor-delta receipt status: **${status}**"
  fi
fi
