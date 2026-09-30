@echo off
setlocal
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Install GitHub Desktop from https://desktop.github.com/
  echo Then follow README.md.
  pause
  exit /b 1
)

echo.
echo Create an empty PUBLIC repository named analytics-job-scout on GitHub first.
set /p GHUSER=Enter your GitHub username: 
if "%GHUSER%"=="" exit /b 1

git init
git add .
git commit -m "Deploy Analytics Job Scout"
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin https://github.com/%GHUSER%/analytics-job-scout.git
git push -u origin main

echo.
echo If the push succeeded, enable GitHub Actions under Settings - Pages.
echo Your site will be: https://%GHUSER%.github.io/analytics-job-scout/
pause
