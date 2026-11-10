param([string]$Extra = '')
$exe = "C:\Users\user\Documents\smth-new\deepr-tauri\target\debug\melatonyne.exe"
$base = "C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem"
$env:PATH = if ($Extra) { "$Extra;$base" } else { $base }
$p = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 8
if ($p.HasExited) {
  "PATH=[$Extra] EXITED code=$($p.ExitCode)"
} else {
  "PATH=[$Extra] ALIVE pid=$($p.Id)"
  Stop-Process -Id $p.Id -Force
}
