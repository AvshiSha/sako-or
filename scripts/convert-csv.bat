@echo off
REM CSV to JSON Converter Batch Script for Windows
REM Usage: convert-csv.bat input.csv output.json

if "%~2"=="" (
    echo Usage: convert-csv.bat ^<input.csv^> ^<output.json^>
    echo.
    echo Example:
    echo   convert-csv.bat my-products.csv my-products.json
    pause
    exit /b 1
)

echo Converting CSV to JSON...
node scripts/csv-to-json-converter.js %1 %2

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Conversion completed successfully!
    echo 📁 Output file: %2
    echo.
    echo You can now import this JSON file through your admin panel.
) else (
    echo.
    echo ❌ Conversion failed. Please check the error messages above.
)

pause
