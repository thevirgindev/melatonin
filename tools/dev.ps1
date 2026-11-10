param()
$ErrorActionPreference = 'SilentlyContinue'
Stop-Process -Name deepr-tauri -Force
Start-Sleep -Seconds 2
cargo run
