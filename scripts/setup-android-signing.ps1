# ==============================================================================
# Android Release Keystore Generator & GitHub Secrets Uploader
# Run once from project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-android-signing.ps1
# ==============================================================================

$ErrorActionPreference = 'Stop'

$repo = "qqwwqq1355-cmd/essa"
$keystoreDir = Join-Path $PSScriptRoot "..\apps\mobile\android\keystore"
$keystorePath = Join-Path $keystoreDir "essa-release.keystore"
$propsPath = Join-Path $keystoreDir "keystore.properties"
$keyAlias = "essa_release"

# 1) Locate keytool.exe (Android Studio JBR or JAVA_HOME)
$keytoolCandidates = @(
    $(if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\keytool.exe" }),
    "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
    $(if (Get-Command keytool -ErrorAction SilentlyContinue) { (Get-Command keytool).Source })
) | Where-Object { $_ -and (Test-Path $_) }

if ($keytoolCandidates.Count -eq 0) {
    Write-Host "[ERROR] keytool.exe not found! Ensure JAVA_HOME or Android Studio is installed." -ForegroundColor Red
    exit 1
}
$keytool = $keytoolCandidates[0]
Write-Host "[1/4] Using keytool: $keytool" -ForegroundColor Cyan

# 2) Ensure keystore directory exists (gitignored)
New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

# 3) Load existing password or generate strong random 24-char password
$storePassword = $null
if ((Test-Path $keystorePath) -and (Test-Path $propsPath)) {
    Write-Host "[2/4] Existing release keystore found - reusing it." -ForegroundColor Yellow
    $propsText = Get-Content $propsPath -Raw
    if ($propsText -match 'storePassword=(.+)') {
        $storePassword = $matches[1].Trim()
    }
    if ($propsText -match 'keyAlias=(.+)') {
        $keyAlias = $matches[1].Trim()
    }
}

if (-not $storePassword) {
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 24
    $rng.GetBytes($bytes)
    $storePassword = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
    $rng.Dispose()
}

if (-not (Test-Path $keystorePath)) {
    Write-Host "[2/4] Generating 25-year RSA-2048 Release Keystore..." -ForegroundColor Cyan
    & $keytool -genkeypair -v `
        -storetype PKCS12 `
        -keystore $keystorePath `
        -alias $keyAlias `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass $storePassword `
        -keypass $storePassword `
        -dname "CN=Essa Al-Laith Library, OU=Mobile, O=EssaAllaith, L=Sanaa, S=Sanaa, C=YE"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to generate keystore." -ForegroundColor Red
        exit 1
    }

    @(
        "storeFile=keystore/essa-release.keystore",
        "storePassword=$storePassword",
        "keyAlias=$keyAlias",
        "keyPassword=$storePassword"
    ) | Set-Content -Path $propsPath -Encoding ASCII

    Write-Host "[OK] Keystore saved locally (gitignored): $keystorePath" -ForegroundColor Green
}

# 4) Base64-encode keystore and upload all 4 secrets to GitHub
Write-Host "[3/4] Encoding keystore to Base64..." -ForegroundColor Cyan
$base64Keystore = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($keystorePath))

Write-Host "[4/4] Uploading 4 Android signing secrets to GitHub ($repo)..." -ForegroundColor Cyan
gh secret set ANDROID_KEYSTORE_BASE64 --body $base64Keystore --repo $repo
gh secret set ANDROID_STORE_PASSWORD  --body $storePassword  --repo $repo
gh secret set ANDROID_KEY_ALIAS       --body $keyAlias       --repo $repo
gh secret set ANDROID_KEY_PASSWORD    --body $storePassword  --repo $repo

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "SUCCESS! Release keystore created and uploaded to GitHub Secrets!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "IMPORTANT: Back up these 2 local files safely (NEVER delete them):" -ForegroundColor Yellow
Write-Host "  1) $keystorePath"
Write-Host "  2) $propsPath"
Write-Host ""
gh secret list --repo $repo
