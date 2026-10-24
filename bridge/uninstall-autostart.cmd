@echo off
rem Toxic Skill: remove the bridge from autostart
schtasks /End /TN "ToxicSkill Gizmo Bridge" >nul 2>&1
schtasks /Delete /F /TN "ToxicSkill Gizmo Bridge"
pause
