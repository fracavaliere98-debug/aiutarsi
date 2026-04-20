@echo off
echo Setting up environment...
set "PATH=%PATH%;C:\Program Files\nodejs"
echo Running regression test suite...
call npm run test:regression
if %errorlevel% neq 0 (
    echo Tests Failed!
) else (
    echo Tests Passed!
)
pause
