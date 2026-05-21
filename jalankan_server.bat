@echo off
title Maia-2 Human-like Server
color 0a

echo ====================================================
echo    MAIA-2 HUMAN-LIKE CHESS ENGINE SERVER
echo ====================================================
echo.

cd /d "%~dp0"

echo Memeriksa environment...
echo.

echo Menjalankan server Maia-2 Human-like Engine...
echo Server akan berjalan di http://127.0.0.1:5000
echo.

py server.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server berhenti mendadak atau tidak bisa jalan.
    echo Mencoba dengan python...
    python server.py
)

pause
