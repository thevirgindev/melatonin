$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut("$env:USERPROFILE\Desktop\Melatonin.lnk")
$lnk.TargetPath = "$env:LOCALAPPDATA\Melatonin\app\melatonin.exe"
$lnk.WorkingDirectory = "$env:LOCALAPPDATA\Melatonin\app"
$lnk.IconLocation = "$env:LOCALAPPDATA\Melatonin\app\melatonin.exe,0"
$lnk.Description = 'Melatonin'
$lnk.Save()
Write-Host "shortcut: $env:USERPROFILE\Desktop\Melatonin.lnk"
