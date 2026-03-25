@echo off
title Pushing to GitHub + Vercel...
echo.
echo ==============================
echo   Auto-Push to GitHub + Vercel
echo ==============================
echo.

:: Ask for a commit message (or use a default)
set /p msg="Commit message (press Enter to use 'update'): "
if "%msg%"=="" set msg=update

git add .
git commit -m "%msg%"
git push

echo.
echo ✅ Done! Vercel is now deploying automatically.
echo 🌐 Check: https://vercel.com/raizianofficial/ai-barcode-billing-system
echo.
pause
