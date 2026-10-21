@echo off
chcp 65001 >nul
cd /d "%~dp0"
where dotnet >nul 2>nul
if errorlevel 1 (
  echo Chua tim thay .NET SDK. Cai .NET 8 SDK hoac Visual Studio voi ASP.NET and web development.
  pause
  exit /b 1
)
echo Giu cua so nay mo. Khi server khoi dong, truy cap http://localhost:5188
dotnet run --project "src\JwtDemo\JwtDemo.csproj" --launch-profile JwtDemo
pause
