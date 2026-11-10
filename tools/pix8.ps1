Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\user\Documents\smth-new\deepr-tauri\latest7.png')
$w = $bmp.Width; $h = $bmp.Height
$top = $bmp.GetPixel([int]($w/2), 5)
$center = $bmp.GetPixel([int]($w/2), [int]($h/2))
Write-Output "size: ${w}x${h}"
Write-Output "top: R=$($top.R) G=$($top.G) B=$($top.B)"
Write-Output "center: R=$($center.R) G=$($center.G) B=$($center.B)"
$nonWhite = 0; $total = 0
for ($x = 0; $x -lt $w; $x += 5) {
  for ($y = 0; $y -lt $h; $y += 5) {
    $p = $bmp.GetPixel($x, $y)
    $total++
    if ($p.R -lt 240 -or $p.G -lt 240 -or $p.B -lt 240) { $nonWhite++ }
  }
}
Write-Output "non-white: $nonWhite / $total"
$bmp.Dispose()
