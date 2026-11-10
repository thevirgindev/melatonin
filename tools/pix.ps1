Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\user\Documents\smth-new\deepr-tauri\final2.png')
$w = $bmp.Width; $h = $bmp.Height
$center = $bmp.GetPixel([int]($w/2), [int]($h/2))
$top = $bmp.GetPixel([int]($w/2), 100)
Write-Output "size: ${w}x${h}"
Write-Output "center: R=$($center.R) G=$($center.G) B=$($center.B)"
Write-Output "top: R=$($top.R) G=$($top.G) B=$($top.B)"
$nonWhite = 0
$total = 0
for ($x = 0; $x -lt $w; $x += 10) {
  for ($y = 0; $y -lt $h; $y += 10) {
    $p = $bmp.GetPixel($x, $y)
    $total++
    if ($p.R -lt 240 -or $p.G -lt 240 -or $p.B -lt 240) { $nonWhite++ }
  }
}
Write-Output "non-white: $nonWhite / $total"
$bmp.Dispose()
