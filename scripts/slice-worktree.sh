#!/usr/bin/env bash
# slice-worktree: prepare an isolated worktree for one disjoint-scope slice.
#
# Creates a fresh branch + worktree for a single failure-owner slice, copies the
# ignored local context git will not carry, and HARD-REFUSES to touch a branch
# that is checked out in another worktree or any protected promotion branch
# (dev/staging/main). It never copies a stale .env/.env.local between worktrees;
# secrets are rendered fresh on request.
#
# Usage:
#   scripts/slice-worktree.sh <owner> [--base <ref>] [--render <env>] [--dry-run]
#
#   <owner>   one of: retrieval planner validator state corpus scenario
#   --base    start-point for the new branch (default: current HEAD)
#   --render  render fresh secrets for <env> into the new worktree's .env.local
#   --dry-run print the plan and run the safety checks, create nothing
set -euo pipefail

OWNERS="retrieval planner validator state corpus scenario"
PROTECTED="dev staging main"

owner=""
base="HEAD"
render_env=""
dry_run=0

while [ $# -gt 0 ]; do
  case "$1" in
    --) shift ;;
    --base) base="${2:?--base needs a ref}"; shift 2 ;;
    --render) render_env="${2:?--render needs an env}"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    --*) echo "slice-worktree: unknown flag: $1" >&2; exit 2 ;;
    *) if [ -z "$owner" ]; then owner="$1"; shift; else echo "slice-worktree: unexpected arg: $1" >&2; exit 2; fi ;;
  esac
done

[ -n "$owner" ] || { echo "usage: slice-worktree <owner> [--base ref] [--render env] [--dry-run]" >&2; exit 2; }

# shellcheck disable=SC2076
if ! echo " $OWNERS " | grep -q " $owner "; then
  echo "slice-worktree: owner '$owner' is not a disjoint write-scope ($OWNERS)" >&2
  exit 2
fi

# Source context comes from the current worktree; new worktrees are placed as
# siblings under the MAIN repo root (parent of the shared .git common dir).
src_root="$(git rev-parse --show-toplevel)"
common_dir="$(git rev-parse --git-common-dir)"
case "$common_dir" in /*) ;; *) common_dir="$(cd "$common_dir" && pwd)" ;; esac
main_root="$(dirname "$common_dir")"
stamp="$(date +%Y%m%d-%H%M%S)"
branch="slice/${owner}-${stamp}"
worktree_path="${main_root}/.claude/worktrees/slice-${owner}-${stamp}"

# Refuse protected branch names outright.
for protected in $PROTECTED; do
  if [ "$branch" = "$protected" ]; then
    echo "slice-worktree: refusing to create protected branch '$branch'" >&2
    exit 1
  fi
done

# Refuse if the new branch (or the base, when it is a branch) is already checked
# out in another worktree - moving such a pointer corrupts that worktree.
checked_out="$(git worktree list --porcelain | awk '/^branch / {sub("refs/heads/","",$2); print $2}')"
for existing in $checked_out; do
  if [ "$existing" = "$branch" ]; then
    echo "slice-worktree: branch '$branch' is already checked out elsewhere" >&2
    exit 1
  fi
done
for protected in $PROTECTED; do
  if [ "$base" = "$protected" ]; then
    # Using a protected branch as a START-POINT is fine (read-only); checking it
    # out would not be. We only ever create a new branch, so warn and continue.
    echo "slice-worktree: note: basing new branch on '$base' (read-only start-point; not moving it)"
  fi
done

echo "slice-worktree plan:"
echo "  owner:    $owner"
echo "  branch:   $branch"
echo "  base:     $base"
echo "  worktree: $worktree_path"

if [ "$dry_run" -eq 1 ]; then
  echo "  (dry-run: nothing created)"
  exit 0
fi

git worktree add -b "$branch" "$worktree_path" "$base"

# Copy ignored local context git does not carry into a new worktree. Never copy
# .env/.env.local (stale secrets); render fresh instead.
for item in .fallow .claude/settings.local.json .env.example; do
  if [ -e "${src_root}/${item}" ]; then
    mkdir -p "$(dirname "${worktree_path}/${item}")"
    cp -R "${src_root}/${item}" "${worktree_path}/${item}"
    echo "  copied ignored context: ${item}"
  fi
done

if [ -n "$render_env" ]; then
  echo "  rendering fresh secrets for env '$render_env'"
  ( cd "$worktree_path" && node scripts/secrets.mjs render "$render_env" )
else
  echo "  next: render secrets in the new worktree (e.g. cd $worktree_path && just secrets-render <env>)"
fi

echo "slice-worktree ready: cd $worktree_path"
