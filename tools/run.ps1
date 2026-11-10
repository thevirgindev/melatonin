param([switch]$Build, [switch]$Restart)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'target\debug\melatonyne.exe'
$dst = Join-Path $env:LOCALAPPDATA 'Melatonyne\app'

if ($Restart) {
  Stop-Process -Name melatonyne -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

if ($Build) {
  Push-Location $root
  try { cargo build } finally { Pop-Location }
  Stop-Process -Name melatonyne -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $exe)) { throw "missing $exe (run with -Build)" }

# The build output inherits a sandboxed shell's Low integrity label, which makes
# the app and its node child unable to write TEMP / %USERPROFILE%\.dsh. Copying
# into a normal folder gives the binary a Medium label; launch from here.
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item $exe (Join-Path $dst 'melatonyne.exe') -Force
Start-Process -FilePath (Join-Path $dst 'melatonyne.exe')
Write-Host "launched $(Join-Path $dst 'melatonyne.exe')"
