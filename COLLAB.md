# Совместная работа (только git, gh опционально)

## 0. Разово: кто я и чем пушу (свой PAT!)

```bash
git config --global user.name "phpAtom1c"
git config --global user.email "его@email"
git config --global credential.helper store
git config --global pull.rebase true
git config --global init.defaultBranch main
```

PAT создается на сайте 1 раз:
github.com → Settings → Developer settings → Tokens (classic) → Generate, галка `repo`.
Дальше при первом push: Username=`phpAtom1c` / Password=`ghp_...` (не пароль GitHub!).

## 1. Склонировать

```bash
git clone https://github.com/Zisvit/ideaton.git
cd ideaton
git pull --rebase origin main
```

## 2. Ежедневный цикл: ветка → коммит → пуш

```bash
git checkout -b feat/короткое-название
# ... работа ...
git add -A
git commit -m "feat: что сделал"
git push -u origin feat/короткое-название
```

## 3a. Мерж через PR (рекомендуется)

- Без gh: открыть ссылку из вывода push и нажать Merge pull request на сайте.
- С gh (`sudo apt install -y gh`):

```bash
gh auth login -p https -w
gh pr create --base main --head feat/короткое-название --fill
gh pr merge --merge --delete-branch
git checkout main
git pull --rebase origin main
```

## 3b. Мерж локально без PR (только по договоренности, без ревью)

```bash
git checkout main
git pull --rebase origin main
git merge --no-ff feat/короткое-название -m "merge feat/короткое-название"
git push origin main
git push origin --delete feat/короткое-название
git branch -d feat/короткое-название
```

## Правила, чтобы не затирать друг друга

1. В `main` напрямую не коммитить, только в `feat/*`.
2. Перед push всегда `git pull --rebase origin main`.
3. Имя ветки уникальное: `feat/ник-что` (например, `feat/phpAtom1c-auth`).

Если `gh` отвечает 401 Bad credentials — проверить зависший токен в окружении:
`unset GITHUB_TOKEN GH_TOKEN`, затем повторить `gh auth login`.
