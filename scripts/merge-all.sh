#!/usr/bin/env bash
# merge-all: аккуратно слить обе feat-ветки в main и запушить.
# Запускать ТОЛЬКО после того, как друг запушил свои коммиты.
# Использование:
#   ./scripts/merge-all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch origin
git checkout main
git pull --rebase origin main
for b in feat/zisvit-part feat/phpAtom1c-part; do
  if git ls-remote --heads origin "$b" | grep -q "$b"; then
    echo "=== merge $b ==="
    git merge --no-ff "origin/$b" -m "merge $b"
  else
    echo "=== skip $b (нет на origin) ==="
  fi
done
git push origin main
git checkout -
echo OK
