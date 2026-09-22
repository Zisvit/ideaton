#!/usr/bin/env bash
# auto-sync: забрать всё смерженное в main (и обновить feat-ветки) без потери локальной работы.
# Только fast-forward, только при чистом дереве для текущей ветки. Крон дергает каждые 3 мин.
set -u
REPO="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$REPO" || exit 0
unset GITHUB_TOKEN GH_TOKEN
git fetch origin --prune 2>&1 | head -5
CURRENT="$(git branch --show-current)"
# 1. не-текущие ветки — ff-only обновление напрямую
for b in main feat/zisvit-part feat/phpAtom1c-part; do
  if [ "$b" != "$CURRENT" ] && git show-ref --verify --quiet "refs/heads/$b"; then
    git fetch origin "$b:$b" 2>&1 | head -3 || true
  fi
done
# 2. текущая ветка — только если нет правок в отслеживаемых файлах
# (untracked-файлы не блокируют ff-pull)
if git diff --quiet && git diff --cached --quiet; then
  git pull --ff-only 2>&1 | head -5 || true
else
  echo "skip pull on $CURRENT: tracked changes present, not touching local work"
fi
echo "--- $(date -u +%FT%TZ) current=$CURRENT $(git log --oneline -1) ---"
