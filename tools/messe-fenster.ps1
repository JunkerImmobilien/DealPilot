param([ValidateSet('vor','zurueck')][string]$Was, [string]$Titel = 'Messe-Studio')
# Holt GENAU das Chrome-Fenster nach vorne, dessen Titel $Titel enthaelt
# (aktiver Tab), schaltet Vollbild (F11) um - oder setzt es zurueck.
# 14.10.2026: die erste Fassung nahm Get-Process chrome | MainWindowHandle -
# Chrome fuehrt ALLE Fenster in einem Prozess, MainWindowHandle ist irgendeins.
# Getroffen wurde Marcels Arbeitsfenster (PM-Werkstatt, mitten in einer
# Videokonferenz): Vollbild und verschoben. Jetzt: EnumWindows, Titel muss
# passen, sonst KEIN Tastendruck.
Add-Type @"
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class W39 {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  /* Windows gibt den Fokus nur her, wenn der Aufrufer zuletzt eine Eingabe hatte:
     ein kurzes Alt hebt die Sperre auf (bekannter Weg, AllowSetForegroundWindow) */
  public static bool Vor(IntPtr h) { for (int i = 0; i < 3; i++) { if (SetForegroundWindow(h) && GetForegroundWindow() == h) return true;
      keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero); System.Threading.Thread.Sleep(250); } return GetForegroundWindow() == h; }
  public static List<KeyValuePair<IntPtr,string>> Alle() {
    var l = new List<KeyValuePair<IntPtr,string>>();
    EnumWindows((h, p) => { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); var t = sb.ToString();
      if (t.EndsWith("Google Chrome")) l.Add(new KeyValuePair<IntPtr,string>(h, t)); return true; }, IntPtr.Zero);
    return l;
  }
}
"@
Add-Type -AssemblyName System.Windows.Forms
$treffer = [W39]::Alle() | Where-Object { $_.Value -like "*$Titel*" }
if (@($treffer).Count -ne 1) { "ABBRUCH: $(@($treffer).Count) Fenster mit '$Titel' - nichts gesendet. Chrome-Fenster: " + (([W39]::Alle() | ForEach-Object { $_.Value }) -join ' | '); exit 1 }
$h = @($treffer)[0].Key
if ($Was -eq 'vor') {
  [W39]::ShowWindow($h, 9) | Out-Null
  [W39]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, 1920, 1040, 0x40) | Out-Null
  Start-Sleep -Milliseconds 300
  if (-not [W39]::Vor($h)) { "ABBRUCH: Fenster nicht vorne - kein F11"; exit 1 }
  [System.Windows.Forms.SendKeys]::SendWait("{F11}")
  Start-Sleep -Seconds 2
  "vorn: $(@($treffer)[0].Value)"
} else {
  if (-not [W39]::Vor($h)) { "ABBRUCH: Fenster nicht vorne - kein F11"; exit 1 }
  [System.Windows.Forms.SendKeys]::SendWait("{F11}")
  Start-Sleep -Seconds 1
  [W39]::ShowWindow($h, 6) | Out-Null
  "zurueck und minimiert: $(@($treffer)[0].Value)"
}
