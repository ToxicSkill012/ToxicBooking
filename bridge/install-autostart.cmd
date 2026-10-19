@echo off
rem Toxic Skill: start the Gizmo bridge automatically when Windows boots.
rem Right-click this file and choose "Run as administrator".
schtasks /Create /F /TN "ToxicSkill Gizmo Bridge" /SC ONSTART /DELAY 0001:00 /RU SYSTEM /RL HIGHEST /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0gizmo-bridge.ps1\""
if errorlevel 1 (echo FAILED: run this file as administrator) else (schtasks /Run /TN "ToxicSkill Gizmo Bridge" & echo OK: bridge is running and will start with Windows. Log: %~dp0bridge.log)
pause
