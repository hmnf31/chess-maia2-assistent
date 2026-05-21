@echo off
:: Judul disederhanakan tanpa '&' agar terbaca sempurna oleh script pematikan
title Server Engine Catur
color 0a

echo ====================================================
echo    MENYALAKAN SERVER ENGINE CATUR (HYBRID)
echo ====================================================
echo.

:: Masuk ke folder proyek Anda
cd /d "C:\Users\Administrator\Desktop\Maia-server\lc0-windows-cpu"

echo Memeriksa koneksi engine...
echo Pastikan lc0.exe dan stockfish.exe ada di folder ini.
echo.

:: Menjalankan server menggunakan 'py'
py server.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server berhenti mendadak atau tidak bisa jalan.
    echo Mencoba menjalankan dengan perintah alternatif...
    python server.py
)

pause

