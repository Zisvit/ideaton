#!/usr/bin/env bash
# auto-commit: Dropbox-режим для своей feat-ветки.
# Дергается systemd path-юнитом при любом изменении файлов.
# Ждет 10 сек (файл допишется), коммитит всё одним autosync-коммитом, пушит.
# В main НЕ пушит никогда — туда сливает бот.
set -u
REPO="${1:-/home/deb/Projects/ideaton}"
cd "$REPO" || exit 0
unset GITHUB_TOKEN GH_TOKEN
BR="$(git branch --show-current)"
case "$BR" in
  feat/*) ;;
  *) echo "auto-commit: skip, current branch $BR is not feat/*"; exit 0 ;;
esac
sleep 10
git add -A
if git diff --cached --quiet; then
  echo "auto-commit: nothing to commit"
  exit 0
fi
git commit -m "autosync: $(date -u +%FT%TZ)" 2>&1 | head -2
git push -u origin "$BR" 2>&1 | tail -2
