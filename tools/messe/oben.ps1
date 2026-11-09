param([ValidateSet('an','aus')][string]$Was, [string]$Titel = 'Messe-Studio')
# Hält das Studio-Fenster während der Aufnahme ÜBER allen anderen (HWND_TOPMOST) - am 09.11. schob sich
# zweimal ein anderes Fenster davor. 'aus' gibt den normalen Zustand zurück (HWND_NOTOPMOST).
Add-Type @"
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class W41 {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  public static IntPtr Finde(string t) { IntPtr r = IntPtr.Zero; int n = 0;
    EnumWindows((h, p) => { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); var s = sb.ToString();
      if (s.EndsWith("Google Chrome") && s.Contains(t)) { r = h; n++; } return true; }, IntPtr.Zero);
    return n == 1 ? r : IntPtr.Zero; }
}
"@
$h = [W41]::Finde($Titel)
if ($h -eq [IntPtr]::Zero) { "ABBRUCH: Fenster '$Titel' nicht eindeutig"; exit 1 }
$z = if ($Was -eq 'an') { [IntPtr](-1) } else { [IntPtr](-2) }
[W41]::SetWindowPos($h, $z, 0, 0, 0, 0, 0x0003) | Out-Null   # SWP_NOSIZE | SWP_NOMOVE
"oben $Was"
