@echo off
setlocal
set "APP_DIR=%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $connection) { Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%APP_DIR%servidor.ps1') -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden }; $ready = $false; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000' -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if ($ready) { Start-Process 'http://127.0.0.1:3000' } else { Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('La plataforma no pudo iniciarse. Vuelve a intentarlo o contacta con soporte.','Tradinverso') }"

endlocal
