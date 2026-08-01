# =============================================================
#  SERVIGO 2.0 - first push to GitHub
#
#  Run from inside the servigo2.o folder:
#      powershell -ExecutionPolicy Bypass -File .\push.ps1
#
#  Assumes the GitHub CLI (gh) is installed and you are signed in.
#  If gh is missing, the script falls back to plain git and tells you
#  to create the repository in the browser first.
# =============================================================

$ErrorActionPreference = "Stop"
$RepoName = "servigo2.o"

Write-Host "Preparing $RepoName ..." -ForegroundColor Cyan

# Safety check: make sure no secrets are about to be committed.
if (Test-Path ".env.local") {
    Write-Host "Found .env.local - it is gitignored and will NOT be pushed." -ForegroundColor Yellow
}

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

git add .
git status --short

Write-Host ""
Write-Host "Review the file list above. Nothing named .env should appear." -ForegroundColor Yellow
$confirm = Read-Host "Commit and push? (y/n)"
if ($confirm -ne "y") { Write-Host "Aborted."; exit 0 }

git commit -m "SERVIGO 2.0 - Next.js 15 rewrite, Vercel ready, env-bootstrap admin auth"

$hasGh = Get-Command gh -ErrorAction SilentlyContinue

if ($hasGh) {
    Write-Host "Creating GitHub repository via gh ..." -ForegroundColor Cyan
    gh repo create $RepoName --public --source=. --remote=origin --push
    Write-Host ""
    Write-Host "Done. Now import the repo at https://vercel.com/new" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "GitHub CLI not found." -ForegroundColor Yellow
    Write-Host "1. Create an empty repository named $RepoName at https://github.com/new"
    Write-Host "2. Then run:"
    Write-Host "     git remote add origin https://github.com/<your-username>/$RepoName.git"
    Write-Host "     git push -u origin main"
}
