param([string]$Name, [int]$Sekunden, [int]$Vorlauf = 45)
# M6 25.11.2026: Aufnahme starten und das Studio per Leertaste starten (ohne Browser-Erweiterung,
# damit deren Arbeits-Rahmen nicht ins Bild kommt). Wartet vorher $Vorlauf s, bis der Rahmen weg ist,
# legt ein Kontrollbild ab und wartet bis ffmpeg fertig ist.
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public class W60 {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
  public static bool Vor(IntPtr h) { for (int i = 0; i < 4; i++) { if (SetForegroundWindow(h) && GetForegroundWindow() == h) return true; keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero); System.Threading.Thread.Sleep(250); } return GetForegroundWindow() == h; }
  public static IntPtr Finde(string t) { IntPtr r = IntPtr.Zero;
    EnumWindows((h, p) => { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); if (sb.ToString().Contains(t) && sb.ToString().EndsWith("Google Chrome")) r = h; return true; }, IntPtr.Zero); return r; }
}
"@
Start-Sleep -Seconds $Vorlauf
& "E:\DealPilot\repo\tools\messe\stichbild.ps1" -Ziel "$env:TEMP\m6-vorstart.png" | Out-Null
$h = [W60]::Finde('Messe-Studio'); if ($h -eq [IntPtr]::Zero) { "KEIN STUDIO-FENSTER"; exit 1 }
$p = Start-Process powershell -ArgumentList "-NoProfile -File E:\DealPilot\repo\tools\messe-aufnahme.ps1 -Name $Name -Sekunden $Sekunden" -PassThru -WindowStyle Hidden
$t0 = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
Start-Sleep -Milliseconds 1500
# M7 25.11.: Fokus mit Alt-Trick, dann Klick auf 'Aufnahme starten' (Bildmitte) - die Leertaste kam zweimal nicht an
[W60]::Vor($h) | Out-Null; Start-Sleep -Milliseconds 200
[W60]::SetCursorPos(960, 520) | Out-Null; Start-Sleep -Milliseconds 100
[W60]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [W60]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 300; [W60]::SetCursorPos(1919, 1079) | Out-Null
$tl = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
Wait-Process -Id $p.Id -Timeout ($Sekunden + 60)
"t0 $t0 los $tl"
