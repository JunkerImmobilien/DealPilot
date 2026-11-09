param([string]$Titel = 'Messe-Studio')
# Schaltet im (einzigen) Chrome-Fenster per Strg+Tab weiter, bis der Tab mit $Titel aktiv ist.
Add-Type @"
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class W40 {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  public static List<KeyValuePair<IntPtr,string>> Alle() {
    var l = new List<KeyValuePair<IntPtr,string>>();
    EnumWindows((h, p) => { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); var t = sb.ToString();
      if (t.EndsWith("Google Chrome")) l.Add(new KeyValuePair<IntPtr,string>(h, t)); return true; }, IntPtr.Zero);
    return l;
  }
  public static string Titel(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
}
"@
Add-Type -AssemblyName System.Windows.Forms
$w = @([W40]::Alle())
if ($w.Count -ne 1) { "ABBRUCH: $($w.Count) Chrome-Fenster"; exit 1 }
$h = $w[0].Key
[W40]::ShowWindow($h, 9) | Out-Null
for ($i = 0; $i -lt 3 -and [W40]::GetForegroundWindow() -ne $h; $i++) { [W40]::keybd_event(0x12,0,0,[UIntPtr]::Zero); [W40]::keybd_event(0x12,0,2,[UIntPtr]::Zero); [W40]::SetForegroundWindow($h) | Out-Null; Start-Sleep -Milliseconds 250 }
if ([W40]::GetForegroundWindow() -ne $h) { "ABBRUCH: Fenster nicht vorne"; exit 1 }
for ($i = 0; $i -lt 12; $i++) {
  if ([W40]::Titel($h) -like "*$Titel*") { "aktiv: $([W40]::Titel($h))"; exit 0 }
  [System.Windows.Forms.SendKeys]::SendWait("^{TAB}"); Start-Sleep -Milliseconds 400
}
"ABBRUCH: Tab '$Titel' nicht gefunden"; exit 1
