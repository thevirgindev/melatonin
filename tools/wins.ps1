param([uint32]$Pid2 = 0)
$src = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class W3 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static string Dump(uint pid) {
    var sb2 = new StringBuilder();
    EnumWindows((h, l) => {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p == pid) {
        var t = new StringBuilder(256); GetWindowText(h, t, 256);
        RECT r; GetWindowRect(h, out r);
        sb2.AppendLine("hwnd=" + h + " vis=" + IsWindowVisible(h) + " title='" + t + "' rect=" + r.L + "," + r.T + "," + r.R + "," + r.B);
      }
      return true;
    }, IntPtr.Zero);
    return sb2.ToString();
  }
}
'@
Add-Type -TypeDefinition $src
if ($Pid2 -ne 0) { [W3]::Dump($Pid2) }
else {
  foreach ($p in Get-Process melatonin -ErrorAction SilentlyContinue) {
    "pid $($p.Id):"; [W3]::Dump([uint32]$p.Id)
  }
}
