param([ValidateSet('vor','zurueck')][string]$Was)
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W32 {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
$p = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*DealPilot*' } | Select-Object -First 1
if (-not $p) { $p = Get-Process chrome | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }
if (-not $p) { "kein Chrome-Fenster"; exit 1 }
$h = $p.MainWindowHandle
Add-Type -AssemblyName System.Windows.Forms
if ($Was -eq 'vor') {
  [W32]::ShowWindow($h, 9) | Out-Null
  [W32]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, 1920, 1040, 0x40) | Out-Null
  [W32]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 800
  [System.Windows.Forms.SendKeys]::SendWait("{F11}")
  Start-Sleep -Seconds 2
  "vorn: $($p.MainWindowTitle)"
} else {
  [W32]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 500
  [System.Windows.Forms.SendKeys]::SendWait("{F11}")
  Start-Sleep -Seconds 1
  [W32]::ShowWindow($h, 6) | Out-Null
  "zurueck und minimiert"
}
