Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile('C:\Users\user\Documents\smth-new\deepr-tauri\welcome-shot.png')
$w = 599; $h = 699
foreach ($c in @(@(2,2), @(597,2), @(2,697), @(597,697), @(1,1), @(598,1))) {
  $p = $b.GetPixel($c[0], $c[1])
  "($($c[0]),$($c[1])) = R$($p.R) G$($p.G) B$($p.B)"
}
$b.Dispose()
