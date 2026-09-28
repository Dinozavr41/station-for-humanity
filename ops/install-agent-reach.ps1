$ErrorActionPreference = 'Stop'
Write-Host '=== Station / Agent Reach safe bootstrap ==='
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) { throw 'Python not found. Install Python 3.11+ first.' }

if ($py.Name -eq 'py.exe') {
  & py -m pip install --upgrade "https://github.com/Panniantong/agent-reach/archive/main.zip"
} else {
  & python -m pip install --upgrade "https://github.com/Panniantong/agent-reach/archive/main.zip"
}

# Safe mode: checks environment and ~/.agent-reach only; no --system here.
& agent-reach install --env=auto
& agent-reach doctor --json

Write-Host ''
Write-Host 'Bootstrap finished. If doctor reports missing upstream tools, review them before any system-level install.'
Write-Host 'Do NOT add --system unless you intentionally approve those machine-level changes.'
