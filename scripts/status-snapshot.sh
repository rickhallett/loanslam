#!/usr/bin/env bash
# status-snapshot: read-only orientation snapshot for the loanslam operator.
#
# One compact view of where you are before any mutating work: current branch and
# upstream, ahead/behind, dirty state, every worktree and the branch it holds,
# and whether the ops-loop pre-commit hook is active. Makes no changes.
#
# Usage: scripts/status-snapshot.sh
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo '(none)')"
dirty_count="$(git status --porcelain | wc -l | tr -d ' ')"

ahead_behind="n/a"
if [ "$upstream" != "(none)" ]; then
  set +e
  counts="$(git rev-list --left-right --count "${upstream}...HEAD" 2>/dev/null)"
  set -e
  if [ -n "$counts" ]; then
    behind="$(echo "$counts" | awk '{print $1}')"
    ahead="$(echo "$counts" | awk '{print $2}')"
    ahead_behind="ahead ${ahead}, behind ${behind}"
  fi
fi

hooks_path="$(git config core.hooksPath || echo '(default .git/hooks)')"
if [ "$hooks_path" = "scripts/hooks" ]; then
  hook_state="active (scripts/hooks)"
else
  hook_state="NOT active - run: git config core.hooksPath scripts/hooks"
fi

echo "## status snapshot"
echo "- branch:   ${branch}"
echo "- upstream: ${upstream} (${ahead_behind})"
echo "- working tree: ${dirty_count} changed path(s)"
echo "- pre-commit gate: ${hook_state}"
echo "- worktrees:"
git worktree list --porcelain | awk '
  /^worktree / { path=$2 }
  /^branch /   { sub("refs/heads/","",$2); printf "  - %s -> %s\n", $2, path }
  /^detached/  { printf "  - (detached) -> %s\n", path }
'
