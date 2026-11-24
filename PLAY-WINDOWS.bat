@echo off
cd /d "%~dp0"
if not exist "%~dp0dist\index.html" (
  echo ERROR: Extract the entire ZIP first. dist\index.html is missing.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:8090/ in Chrome or Edge.
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 -m http.server 8090 --bind 127.0.0.1 --directory "%~dp0dist"
) else (
  python -m http.server 8090 --bind 127.0.0.1 --directory "%~dp0dist"
)
pause
