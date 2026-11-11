param()
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root 'icons'
$distDir = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

function New-Mark([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded dark tile
  $r = [int]($size * 0.22)
  $tile = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $tile.AddArc(0, 0, $d, $d, 180, 90)
  $tile.AddArc($size - $d, 0, $d, $d, 270, 90)
  $tile.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $tile.AddArc(0, $size - $d, $d, $d, 90, 90)
  $tile.CloseFigure()
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 17, 21))
  $g.FillPath($bg, $tile)
  $penEdge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 44, 46, 52)), ([Math]::Max(1, $size * 0.004))
  $g.DrawPath($penEdge, $tile)

  # M monogram: four strokes, round joints and caps
  $pts = @(
    (New-Object System.Drawing.PointF ($size * 0.265), ($size * 0.715)),
    (New-Object System.Drawing.PointF ($size * 0.265), ($size * 0.285)),
    (New-Object System.Drawing.PointF ($size * 0.500), ($size * 0.560)),
    (New-Object System.Drawing.PointF ($size * 0.735), ($size * 0.285)),
    (New-Object System.Drawing.PointF ($size * 0.735), ($size * 0.715))
  )
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ($size * 0.075)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawLines($pen, $pts)

  $g.Dispose(); $pen.Dispose(); $penEdge.Dispose(); $bg.Dispose(); $tile.Dispose()
  return $bmp
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

# Master icon
$master = New-Mark 1024
Save-Png $master (Join-Path $iconDir 'icon.png')

# Web/PWA sizes consumed by the embedded client
$sizes = @{ 'icon-192.png' = 192; 'icon-512.png' = 512; 'icon-maskable-512.png' = 512; 'apple-touch-icon.png' = 180 }
foreach ($name in $sizes.Keys) {
  $b = New-Mark $sizes[$name]
  Save-Png $b (Join-Path $distDir $name)
  Save-Png $b (Join-Path $iconDir $name)
  $b.Dispose()
}

# ICO: single 256px PNG entry wrapped in an ICO header
$icoBmp = New-Mark 256
$ms = New-Object System.IO.MemoryStream
$icoBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$ms.Dispose()
$fs = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter($fs)
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)
$w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0)
$w.Write([UInt16]1); $w.Write([UInt16]32)
$w.Write([UInt32]$png.Length); $w.Write([UInt32]22)
$w.Write($png)
$w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $iconDir 'icon.ico'), $fs.ToArray())
$w.Dispose(); $fs.Dispose(); $icoBmp.Dispose(); $master.Dispose()

Write-Host 'brand icons written'
