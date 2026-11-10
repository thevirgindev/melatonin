# PrintWindow capture for a foreground-occluded Tauri window.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File clipwin.ps1 HWND OUT
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PrintW {
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, int f);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    public struct RECT { public int l,t,r,b; }
}
"@
$hwnd = [IntPtr]::new([Convert]::ToInt64($args[0], 16))
$out = $args[1]
$r = New-Object PrintW+RECT
[PrintW]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$w = $r.r - $r.l; $h = $r.b - $r.t
Write-Output "rect $w x $h"
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$dc = $g.GetHdc()
[PrintW]::PrintWindow($hwnd, $dc, 3) | Out-Null
$g.ReleaseHdc($dc); $g.Dispose()
$bmp.Save($out)
$bmp.Dispose()
Write-Output "saved $out ${w}x${h}"
