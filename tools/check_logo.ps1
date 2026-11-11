Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\user\Documents\smth-new\deepr-tauri\final16.png')
$w = $bmp.Width; $h = $bmp.Height
# Check the logo area (top-left, around 20,20 to 60,60)
$maxBrightness = 0
$nonDark = 0
for ($x = 10; $x -lt 70; $x++) {
  for ($y = 10; $y -lt 60; $y++) {
    $p = $bmp.GetPixel($x, $y)
    $brightness = [Math]::Max($p.R, [Math]::Max($p.G, $p.B))
    if ($brightness -gt $maxBrightness) { $maxBrightness = $brightness }
    if ($brightness -gt 100) { $nonDark++ }
  }
}
Write-Output "logo area (10,10)-(70,60): maxBrightness=$maxBrightness, nonDark pixels (brightness>100)=$nonDark"
# Check the top bar
$topBarNonDark = 0
for ($x = 0; $x -lt $w; $x += 2) {
  for ($y = 0; $y -lt 40; $y++) {
    $p = $bmp.GetPixel($x, $y)
    $brightness = [Math]::Max($p.R, [Math]::Max($p.G, $p.B))
    if ($brightness -gt 100) { $topBarNonDark++ }
  }
}
Write-Output "titlebar area (0,0)-($w,40): nonDark pixels (brightness>100)=$topBarNonDark"
$bmp.Dispose()
