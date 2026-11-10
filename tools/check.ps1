Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\user\Documents\smth-new\deepr-tauri\check.png')
$w = $bmp.Width; $h = $bmp.Height
# Check top-left corner (sidebar area)
$tl = $bmp.GetPixel(50, 50)
# Check center (main area)
$mc = $bmp.GetPixel([int]($w/2), [int]($h/2))
# Check bottom (chatbar area)
$bc = $bmp.GetPixel([int]($w/2), $h - 50)
Write-Output "top-left: R=$($tl.R) G=$($tl.G) B=$($tl.B)"
Write-Output "center: R=$($mc.R) G=$($mc.G) B=$($mc.B)"
Write-Output "bottom-center: R=$($bc.R) G=$($bc.G) B=$($bc.B)"
$bmp.Dispose()
