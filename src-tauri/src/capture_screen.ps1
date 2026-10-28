$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Text;
public static class AxionWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
# Physical pixels on scaled displays, so the whole screen is captured.
[AxionWin]::SetProcessDPIAware() | Out-Null
$title = New-Object System.Text.StringBuilder 512
[AxionWin]::GetWindowText([AxionWin]::GetForegroundWindow(), $title, 512) | Out-Null

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$full = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($full)
$g.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
$g.Dispose()

# Readable for a vision model, small enough for one request.
$scale = [Math]::Min(1.0, 1600 / $bounds.Width)
$shot = New-Object System.Drawing.Bitmap $full, ([int]($bounds.Width * $scale)), ([int]($bounds.Height * $scale))
$full.Dispose()
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]78)
$stream = New-Object System.IO.MemoryStream
$shot.Save($stream, $jpeg, $params)
$shot.Dispose()

# Line 1: foreground window title (base64 UTF-8), line 2: JPEG (base64).
[Console]::Out.WriteLine([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($title.ToString())))
[Console]::Out.WriteLine([Convert]::ToBase64String($stream.ToArray()))
