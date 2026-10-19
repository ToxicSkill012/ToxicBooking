@echo off
rem Toxic Skill: Gizmo bridge (runs until the window is closed)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gizmo-bridge.ps1"
pause
