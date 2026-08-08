# tools/_gen_verify.ps1
# Generate verify-letter-subscribe.js from a clean base64 payload
# (avoids the write-tool \\n issue by going through PowerShell I/O)

$target = 'D:\clawd_workspace\projects\moonlit-treehouse\tools\verify-letter-subscribe.js'\n$payloadB64 = $args[0]\n\nif (-not $payloadB64) {\n  Write-Host 'usage: _gen_verify.ps1 <base64-payload>'
  exit 1
}

$bytes = [Convert]::FromBase64String($payloadB64)
[System.IO.File]::WriteAllBytes($target, $bytes)
Write-Host "wrote $target ($((Get-Item $target).Length) bytes)"
