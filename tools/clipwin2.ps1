$hwnd = [IntPtr]::new([int]::Parse($args[0], [System.Globalization.NumberStyles]::HexNumber))
$out = $args[1]
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class PrintW {
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, int f);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    public struct RECT { public int l; public int t; public int r; public int b; }
}
"@
$r = New-Object PrintW+RECT
$ok = [PrintW]::GetWindowRect($hwnd, [ref]$r)
Write-Output "getrect ok=$ok l=$($r.l) t=$($r.t) r=$($r.r) b=$($r.b)"
$w = $r.r - $r.l
$h = $r.b - $r.t
Write-Output "size $w x $h"
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$dc = $g.GetHdc()
$pok = [PrintW]::PrintWindow($hwnd, $dc, 3)
Write-Output "print ok=$pok"
$g.ReleaseHdc($dc)
$g.Dispose()
$bmp.Save($out)
$bmp.Dispose()
Write-Output "saved $out"
