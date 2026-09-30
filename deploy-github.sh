#!/usr/bin/env bash
set -euo pipefail
printf 'Create an empty PUBLIC GitHub repository named analytics-job-scout first.\n'
read -rp 'GitHub username: ' GHUSER
[ -n "$GHUSER" ]
git init
git add .
git commit -m 'Deploy Analytics Job Scout'
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$GHUSER/analytics-job-scout.git"
git push -u origin main
printf '\nEnable GitHub Actions in Settings > Pages.\n'
printf 'Your site will be: https://%s.github.io/analytics-job-scout/\n' "$GHUSER"
