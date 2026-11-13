@echo off
rem dengdeng: weekly local calibration of new vipassana lecture segments (called by Task Scheduler)
cd /d "%~dp0.."
if not exist tools\cache mkdir tools\cache
set PYTHONIOENCODING=utf8
"C:\Users\User\AppData\Local\Programs\Python\Python313\python.exe" tools\local_weekly.py >> tools\cache\local_weekly.log 2>&1
