# fix-verify-letter-subscribe.ps1
# Decode a base64 file written by agent and write it to the target.
param([string]$TargetPath, [string]$B64Path)
$bytes = [System.IO.File]::ReadAllBytes($B64Path)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
[System.IO.File]::WriteAllText($TargetPath, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "wrote $TargetPath ($((Get-Item $TargetPath).Length) bytes)"
