@echo off
rem ============================================================
rem  Build Delta Range EXE (Node SEA single-file)
rem  Output: ..\三角洲靶场.exe
rem  Usage: double-click, or run build_exe.bat
rem  Note: this file must be saved in ANSI/GBK encoding (zh-CN)
rem ============================================================
setlocal
cd /d "%~dp0"

set EXE_NAME=三角洲靶场.exe
set BLOB=sea-prep.blob
set OUT_EXE=%EXE_NAME%
set NPMMIRROR=https://registry.npmmirror.com

echo [1/4] Check Node.js ...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: node not found, please install Node.js first.
    pause & exit /b 1
)
for /f "delims=" %%i in ('where node') do set NODE_PATH=%%i
echo   Node: %NODE_PATH%
node -v

echo [2/4] Generate SEA blob (embed assets) ...
if exist "%BLOB%" del "%BLOB%"
node --experimental-sea-config sea-config.json
if errorlevel 1 (
    echo ERROR: sea-config failed.
    pause & exit /b 1
)

echo [3/4] Copy node.exe as host ...
if exist "%OUT_EXE%" del "%OUT_EXE%"
copy /y "%NODE_PATH%" "%OUT_EXE%" >nul
if errorlevel 1 (
    echo ERROR: copy node.exe failed.
    pause & exit /b 1
)

echo [4/4] Inject blob into exe (postject) ...
rem sentinel MUST be NODE_SEA_FUSE_... (built-in SEA fuse mark in node.exe)
call npx --yes --registry=%NPMMIRROR% postject "%OUT_EXE%" NODE_SEA_BLOB "%BLOB%" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if errorlevel 1 (
    echo   mirror failed, retry with default npm registry ...
    call npx --yes postject "%OUT_EXE%" NODE_SEA_BLOB "%BLOB%" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    if errorlevel 1 (
        echo ERROR: postject inject failed.
        pause & exit /b 1
    )
)

rem move result to parent dir; keep here if original exe is locked
if exist "..\%EXE_NAME%" del "..\%EXE_NAME%" 2>nul
move /y "%OUT_EXE%" "..\%EXE_NAME%" >nul 2>nul
if exist "..\%EXE_NAME%" (
    echo DONE: ..\%EXE_NAME%
) else if exist "%OUT_EXE%" (
    echo DONE (target locked, kept in build dir^): %OUT_EXE%
) else (
    echo ERROR: output missing.
    pause & exit /b 1
)
if exist "%BLOB%" del "%BLOB%"
echo.
echo Build finished.
pause >nul
