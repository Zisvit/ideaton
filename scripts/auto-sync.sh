#!/usr/bin/env bash
# auto-sync: держать все 3 папки (mine/friend/merge) свежими.
# Только fast-forward; worktree с несозраненными правками пропускается, ничего не затирается.
# Крон дергает каждые 3 мин. Detached-корень пропускается всегда.
set -u
REPO="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
<<<<<<< HEAD
TOP="$(git -C "$REPO" rev-parse --show-toplevel 2>/dev/null || echo "$REPO")"
cd "$TOP" || exit 0
=======
cd "$REPO" || exit 0
>>>>>>> origin/main
unset GITHUB_TOKEN GH_TOKEN
git fetch origin --prune 2>&1 | head -5
git worktree list --porcelain | grep '^worktree ' | cut -d' ' -f2- | while IFS= read -r wt; do
  br="$(git -C "$wt" branch --show-current 2>/dev/null)"
  if [ -z "$br" ]; then
    echo "skip $wt: detached-корень, руками"
    continue
  fi
  if git -C "$wt" diff --quiet && git -C "$wt" diff --cached --quiet; then
    git -C "$wt" pull --ff-only 2>&1 | head -3 || true
  else
    echo "skip $wt ($br): есть правки, не трогаю"
  fi
done
echo "--- $(date -u +%FT%TZ) done ---"
