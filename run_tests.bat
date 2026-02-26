@echo off
echo Setting up environment...
set "PATH=%PATH%;C:\Program Files\nodejs"
echo Running Service Layer Tests...
call npx -y ts-node --compiler-options "{\"module\":\"commonjs\"}" scripts/test_services.ts
if %errorlevel% neq 0 (
    echo Tests Failed!
) else (
    echo Tests Passed!
)
pause
