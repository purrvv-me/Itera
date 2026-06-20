# Generates src/renderer/assets/icon.ico — the ITERA match-flame logo.
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp  = New-Object System.Drawing.Bitmap $size, $size
$g    = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)

# ---- rounded dark background ------------------------------------------------
function New-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x,        $y,        $d, $d, 180, 90)
  $p.AddArc($x+$w-$d,  $y,        $d, $d, 270, 90)
  $p.AddArc($x+$w-$d,  $y+$h-$d,  $d, $d,   0, 90)
  $p.AddArc($x,        $y+$h-$d,  $d, $d,  90, 90)
  $p.CloseFigure()
  return $p
}
$bgPath  = New-RoundedRect 0 0 $size $size 56
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,14,14,16))
$g.FillPath($bgBrush, $bgPath)

# ---- work in SVG (64x96) coordinates ----------------------------------------
$s  = 2.4
$g.TranslateTransform([single](128 - 33.5*$s), [single](128 - 47.5*$s))
$g.ScaleTransform([single]$s, [single]$s)

# match stick
$stickBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,231,217,196))
$g.FillRectangle($stickBrush, [single]29, [single]48, [single]6, [single]44)
# match head
$headBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,51,40,42))
$g.FillEllipse($headBrush, [single](32-5), [single](50-6.5), [single]10, [single]13)

# outer flame (vertical orange gradient)
$flame = New-Object System.Drawing.Drawing2D.GraphicsPath
$flame.AddBezier(32,3, 43,21, 52,30, 45,46)
$flame.AddBezier(45,46, 41,56, 23,56, 19,45)
$flame.AddBezier(19,45, 15,34, 26,28, 32,3)
$flame.CloseFigure()
$flameRect  = New-Object System.Drawing.RectangleF 15, 2, 38, 46
$flameBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $flameRect,
  [System.Drawing.Color]::FromArgb(255,255,207,92),
  [System.Drawing.Color]::FromArgb(255,255,90,0),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillPath($flameBrush, $flame)

# inner flame (light core)
$inner = New-Object System.Drawing.Drawing2D.GraphicsPath
$inner.AddBezier(32,22, 38,33, 41,39, 35,47)
$inner.AddBezier(35,47, 31,52, 25,50, 25,43)
$inner.AddBezier(25,43, 25,35, 30,34, 32,22)
$inner.CloseFigure()
$innerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,255,230,163))
$g.FillPath($innerBrush, $inner)

$g.ResetTransform()
$g.Dispose()

# ---- encode PNG, then wrap it in an .ico container --------------------------
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$bmp.Dispose()

$outDir = Join-Path $PSScriptRoot "..\src\renderer\assets"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$outFile = Join-Path $outDir "icon.ico"

$ico = New-Object System.IO.MemoryStream
$bw  = New-Object System.IO.BinaryWriter($ico)
$bw.Write([uint16]0)                  # reserved
$bw.Write([uint16]1)                  # type = icon
$bw.Write([uint16]1)                  # image count
$bw.Write([byte]0)                    # width  (0 => 256)
$bw.Write([byte]0)                    # height (0 => 256)
$bw.Write([byte]0)                    # palette
$bw.Write([byte]0)                    # reserved
$bw.Write([uint16]1)                  # color planes
$bw.Write([uint16]32)                 # bits per pixel
$bw.Write([uint32]$png.Length)        # image size
$bw.Write([uint32]22)                 # offset (6 + 16)
$bw.Write($png)
$bw.Flush()
[System.IO.File]::WriteAllBytes($outFile, $ico.ToArray())
$bw.Dispose()

Write-Output ("icon written: " + (Resolve-Path $outFile).Path + "  (" + (Get-Item $outFile).Length + " bytes)")
