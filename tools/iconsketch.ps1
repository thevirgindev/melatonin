Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("$PSScriptRoot\..\icons\icon.png")
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, 32, 32)
$g.Dispose()
$chars = ' .:-=+*#%@'
for ($y = 0; $y -lt 32; $y++) {
  $line = ''
  for ($x = 0; $x -lt 32; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $l = [int](($c.R * 0.299 + $c.G * 0.587 + $c.B * 0.114) / 256 * ($chars.Length - 1))
    $line += $chars[$l]
  }
  Write-Host $line
}
$bmp.Dispose(); $img.Dispose()
