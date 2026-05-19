# Deploy do pacote de segurança (Edge Functions + migration + secrets + cron)
# Pré-requisito: token em https://supabase.com/dashboard/account/tokens
#
# Uso:
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#   .\scripts\deploy-security.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

$Bun = "$env:USERPROFILE\.bun\bin\bun.exe"
if (-not (Test-Path $Bun)) { $Bun = "bun" }

function Invoke-Supabase {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & $Bun x supabase @Args
  if ($LASTEXITCODE -ne 0) { throw "supabase $($Args -join ' ') falhou (exit $LASTEXITCODE)" }
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host ""
  Write-Host "SUPABASE_ACCESS_TOKEN nao definido." -ForegroundColor Yellow
  Write-Host "1. Abra: https://supabase.com/dashboard/account/tokens"
  Write-Host "2. Crie um token e execute:"
  Write-Host '   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."' -ForegroundColor Cyan
  Write-Host "   .\scripts\deploy-security.ps1"
  Write-Host ""
  exit 1
}

if (-not $env:CRON_SECRET) {
  $env:CRON_SECRET = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  Write-Host "CRON_SECRET gerado automaticamente (guarde em local seguro)." -ForegroundColor Green
}
if (-not $env:PLUGGY_WEBHOOK_SECRET) {
  $env:PLUGGY_WEBHOOK_SECRET = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  Write-Host "PLUGGY_WEBHOOK_SECRET gerado automaticamente." -ForegroundColor Green
}

Write-Host ">> Login com token..." -ForegroundColor Cyan
Invoke-Supabase login --token $env:SUPABASE_ACCESS_TOKEN

Write-Host ">> Link projeto uadwnxqcpfcrpuyetpaw..." -ForegroundColor Cyan
Invoke-Supabase link --project-ref uadwnxqcpfcrpuyetpaw

Write-Host ">> Secrets..." -ForegroundColor Cyan
Invoke-Supabase secrets set "CRON_SECRET=$env:CRON_SECRET" "PLUGGY_WEBHOOK_SECRET=$env:PLUGGY_WEBHOOK_SECRET"

Write-Host ">> Migration (cron seguro)..." -ForegroundColor Cyan
Invoke-Supabase db push

Write-Host ">> app.cron_secret no Postgres..." -ForegroundColor Cyan
$escaped = $env:CRON_SECRET -replace "'", "''"
Invoke-Supabase db query --linked "ALTER DATABASE postgres SET app.cron_secret = '$escaped';"

$functions = @(
  "pluggy-auto-sync", "pluggy-sync", "pluggy-webhook",
  "sync-qsa-empresas", "consulta-cnpj", "scan-boleto", "cliente-ai-summary"
)
Write-Host ">> Deploy functions..." -ForegroundColor Cyan
Invoke-Supabase functions deploy @functions

Write-Host ""
Write-Host "Deploy concluido." -ForegroundColor Green
Write-Host ""
Write-Host "Configure na Pluggy o webhook:" -ForegroundColor Yellow
Write-Host "  https://uadwnxqcpfcrpuyetpaw.supabase.co/functions/v1/pluggy-webhook?secret=$env:PLUGGY_WEBHOOK_SECRET"
Write-Host ""
Write-Host "CRON_SECRET (mesmo valor ja aplicado no banco):" -ForegroundColor Yellow
Write-Host "  $env:CRON_SECRET"
