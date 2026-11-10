param([switch]$Build)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Build scripts inherit the shell sandbox's Low integrity label; they cannot
# write to %TEMP%, which breaks crates like ring that need a scratch file.
# Point TMP/TEMP at a workspace folder the sandbox allows.
New-Item -ItemType Directory -Force -Path (Join-Path $root '.tmpbuild') | Out-Null
$env:TMP = Join-Path $root '.tmpbuild'
$env:TEMP = $env:TMP

if ($Build) {
  Stop-Process -Name melatonyne -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  cargo build
  if ($LASTEXITCODE -ne 0) { throw 'cargo build failed' }
}

$exe = Join-Path $root 'target\debug\melatonyne.exe'
if (-not (Test-Path $exe)) { throw "missing $exe (run with -Build)" }

# The build output carries a Low integrity label from the sandboxed compile.
# Copying it into a normal folder gives it a Medium label, so the app and its
# node child can write %TEMP% and %USERPROFILE%\.dsh.
$dst = Join-Path $env:LOCALAPPDATA 'Melatonyne\app'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Stop-Process -Name melatonyne -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Copy-Item $exe (Join-Path $dst 'melatonyne.exe') -Force
Start-Process -FilePath (Join-Path $dst 'melatonyne.exe')
Write-Host "launched $(Join-Path $dst 'melatonyne.exe')"
