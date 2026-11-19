@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/3] Pulling latest changes...
git pull
echo [2/3] Installing packages...
call npm install
echo [3/3] Starting Expo...
call npx expo start -c
pause
