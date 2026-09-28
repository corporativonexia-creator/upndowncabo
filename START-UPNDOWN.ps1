$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "UP AND DOWN · Phase 2A" -ForegroundColor Cyan
Write-Host "Instalando dependencias..." -ForegroundColor Cyan
npm install

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host ""
    Write-Host "Se creó .env.local." -ForegroundColor Yellow
    Write-Host "Completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." -ForegroundColor Yellow
    Write-Host "Después vuelve a ejecutar este script." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Iniciando Next.js..." -ForegroundColor Green
npm run dev
