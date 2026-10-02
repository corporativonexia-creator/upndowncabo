@echo off
cd /d "%~dp0"
title Up ^& Down POS - Print Bridge
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0UpNDownPrintBridge.ps1" -PrinterName "POS-80C" -Port 18181
pause
