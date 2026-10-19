@echo off
rem Toxic Skill: Gizmo bridge self-check, writes probe.txt
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gizmo-bridge.ps1" -Probe
pause
