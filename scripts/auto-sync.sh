#!/usr/bin/env bash
# auto-sync: держать все 3 папки (mine/friend/merge) свежими.
# - merge/ : ff-only подтягивание main
# - feat-ветки : САМИ вливают свежий main (merge; при конфликте — abort, ветка не ломается)
# - worktree с несохраненными правками пропускается; detached-корень пропускается всегда
# - пуша наружу скрипт НЕ делает (публикует watcher/dev-push); бот пропускает пустые мержи,
#   поэтому петель нет. Крон дергает каждые 3 мин.
set -u
REPO="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TOP="$(git -C "$REPO" rev-parse --show-toplevel 2>/dev/null || echo "$REPO")"
cd "$TOP" || exit 0
unset GITHUB_TOKEN GH_TOKEN
git fetch origin --prune 2>&1 | head -5
git worktree list --porcelain | grep '^worktree ' | cut -d' ' -f2- | while IFS= read -r wt; do
  br="$(git -C "$wt" branch --show-current 2>/dev/null)"
  if [ -z "$br" ]; then
    echo "skip $wt: detached-корень, руками"
    continue
  fi
  if ! git -C "$wt" diff --quiet || ! git -C "$wt" diff --cached --quiet; then
    echo "skip $wt ($br): есть правки, не трогаю"
    continue
  fi
  if [ "$br" != "main" ]; then
    if git -C "$wt" merge --no-edit "origin/main" 2>&1 | head -3; then
      :
    else
      git -C "$wt" merge --abort 2>/dev/null || true
      echo "conflict $wt ($br) <- main: оставляю как есть, нужен разбор руками"
      continue
    fi
  fi
  git -C "$wt" pull --ff-only 2>&1 | head -3 || true
done
echo "--- $(date -u +%FT%TZ) done ---"
