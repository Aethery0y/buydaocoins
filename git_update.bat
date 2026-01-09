@echo off
echo Executing Git Update...
git add .
git commit -m "update"
git push -u origin main
echo.
echo Process Complete.
pause
