@echo off
echo ===================================================
echo   VRCX-Jirai Local Windows Portable Build Script
echo ===================================================
echo.

:: --- [0/3] Check and Auto-Install .NET SDK ---
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] .NET SDK not found on your system.
    echo [INFO] Attempting to auto-install .NET 10 SDK via Winget...
    echo.
    winget install Microsoft.DotNet.SDK.10 --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Auto-install failed. Please install .NET 10 SDK manually:
        echo https://dotnet.microsoft.com/download/dotnet/10.0
        pause
        exit /b %errorlevel%
    )
    echo.
    echo [SUCCESS] .NET 10 SDK installed! 
    echo [IMPORTANT] Please CLOSE this window and RE-RUN the script to refresh PATH.
    pause
    exit /b 0
)

echo [1/3] Building Frontend (Vue)...
call npm run prod
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed! Check errors above.
    pause
    exit /b %errorlevel%
)
echo.

echo [2/3] Building Backend (C#)...
:: Kill any running instances to avoid file lock during PostBuild (nvpatch)
taskkill /F /IM VRCX-Jirai.exe /T >nul 2>&1

call dotnet build Dotnet/VRCX-Cef.csproj -p:Configuration=Release -p:Platform=x64
if %errorlevel% neq 0 (
    echo [ERROR] Backend build failed! Make sure .NET SDK is installed.
    pause
    exit /b %errorlevel%
)
echo.

echo [3/3] Merging Resources...
if not exist "build\Cef\html" mkdir "build\Cef\html"
xcopy "build\html" "build\Cef\html" /E /I /H /Y /Q
if %errorlevel% neq 0 (
    echo [ERROR] Resource merge failed!
    pause
    exit /b %errorlevel%
)
echo.

echo ===================================================
echo [SUCCESS] Local build completed successfully!
echo.
echo You can run the portable executable here:
echo %~dp0build\Cef\VRCX-Jirai.exe
echo ===================================================
pause
