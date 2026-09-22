#!/usr/bin/env bash
# dev-push: одна команда вместо add+commit+push.
# Использование:
#   ./scripts/dev-push.sh "feat: что сделал"
# Работает только на feat/* (на main отказывается — в main сливает бот).
set -euo pipefail
cd "$(dirname "$0")/.."
unset GITHUB_TOKEN GH_TOKEN
BR="$(git branch --show-current)"
case "$BR" in
  feat/*) ;;
  *) echo "Отказ: ты на '$BR'. Перейди на свою ветку: git checkout feat/<твоя>"; exit 1 ;;
esac
MSG="${1:-wip: $(date -u +%FT%TZ)}"
git add -A
if git diff --cached --quiet; then
  echo "нечего коммитить"
else
  git commit -m "$MSG"
fi
git push -u origin "$BR"
echo "OK: $BR запушена, бот дольет в main, cron всем подтянет"
