@echo off
set "PATH=%PATH%;C:\Program Files\nodejs"
echo Running Activity Flow Test...
call npx -y ts-node --compiler-options "{\"module\":\"commonjs\"}" scripts/test_activity_flow.ts
if %errorlevel% neq 0 (
    echo Test Failed!
    exit /b 1
) else (
    echo Test Passed!
    exit /b 0
)
