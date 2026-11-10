Add-Type -AssemblyName System.Drawing
$src = 'C:\Users\user\Documents\smth-new\_upstream\dsh\apps\desktop\resources\icon-windows.png'
$outDir = 'C:\Users\user\Documents\smth-new\deepr-tauri\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$srcImg = [System.Drawing.Image]::FromFile($src)
# 256px PNG for the ICO
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($srcImg, 0, 0, 256, 256)
$g.Dispose()
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$bmp.Dispose()
$srcImg.Dispose()
# ICO wrapper (PNG-encoded entry)
$fs = [System.IO.MemoryStream]::new()
$w = New-Object System.IO.BinaryWriter($fs)
$w.Write([UInt16]0)      # reserved
$w.Write([UInt16]1)      # type icon
$w.Write([UInt16]1)      # count
$w.Write([Byte]0)        # width 256
$w.Write([Byte]0)        # height 256
$w.Write([Byte]0)        # palette
$w.Write([Byte]0)        # reserved
$w.Write([UInt16]1)      # planes
$w.Write([UInt16]32)     # bpp
$w.Write([UInt32]$png.Length)
$w.Write([UInt32]22)     # offset = 6 + 16
$w.Write($png)
$w.Flush()
[System.IO.File]::WriteAllBytes("$outDir\icon.ico", $fs.ToArray())
Copy-Item $src "$outDir\icon.png" -Force
Get-Item "$outDir\icon.ico", "$outDir\icon.png" | Select-Object Name, Length
