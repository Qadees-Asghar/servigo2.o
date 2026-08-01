# =============================================================
#  SERVIGO 2.0 - commit and push to GitHub
#
#  Safe to run repeatedly. First run creates the repository,
#  later runs just commit and push on top of it.
#
#      powershell -ExecutionPolicy Bypass -File .\push.ps1
# =============================================================

$ErrorActionPreference = "Stop"
$RepoName = "servigo2.o"

Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "SERVIGO 2.0 - $PSScriptRoot" -ForegroundColor Cyan
Write-Host ""

if (Test-Path ".env.local") {
    Write-Host "Note: .env.local exists and is gitignored. It will NOT be pushed." -ForegroundColor Yellow
}

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "Nothing to commit - working tree is clean." -ForegroundColor Yellow
}
else {
    git status --short
    Write-Host ""
    Write-Host "Review the list above. Nothing named .env should appear." -ForegroundColor Yellow
    $confirm = Read-Host "Commit these changes? (y/n)"
    if ($confirm -ne "y") { Write-Host "Aborted."; exit 0 }

    $msg = Read-Host "Commit message (blank for default)"
    if ([string]::IsNullOrWhiteSpace($msg)) {
        $msg = "SERVIGO 2.0 - update"
    }
    git commit -m $msg
}

# --- Make sure a remote exists ------------------------------------------
$hasRemote = git remote 2>$null | Where-Object { $_ -eq "origin" }

if (-not $hasRemote) {
    $hasGh = Get-Command gh -ErrorAction SilentlyContinue
    if ($hasGh) {
        Write-Host "Creating GitHub repository $RepoName ..." -ForegroundColor Cyan
        gh repo create $RepoName --public --source=. --remote=origin --push
        Write-Host ""
        Write-Host "Pushed. Import the repo at https://vercel.com/new" -ForegroundColor Green
        exit 0
    }
    else {
        Write-Host ""
        Write-Host "No 'origin' remote and the GitHub CLI is not installed." -ForegroundColor Yellow
        Write-Host "1. Create an empty repo named $RepoName at https://github.com/new"
        Write-Host "2. Then run:"
        Write-Host "     git remote add origin https://github.com/<your-username>/$RepoName.git"
        Write-Host "     git push -u origin main"
        exit 1
    }
}

# --- Push ---------------------------------------------------------------
Write-Host "Pushing to origin/main ..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "Pushed. Vercel will redeploy automatically." -ForegroundColor Green
