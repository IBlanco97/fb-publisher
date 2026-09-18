# Builds a portable, self-contained Windows package under dist\fb-publisher.
#
# The result runs on a machine with no Node.js, no npm and no Playwright
# install: a bundled node.exe runs the Next.js standalone server, Chromium
# ships inside the folder, and all runtime state lives in .\data.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\build-dist.ps1
#         powershell ... -File scripts\build-dist.ps1 -SkipNextBuild   (reuse .next)

param(
  [switch]$SkipNextBuild,
  [switch]$Zip
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Root    = Split-Path -Parent $PSScriptRoot
$Dist    = Join-Path $Root 'dist'
$Out     = Join-Path $Dist 'fb-publisher'
$AppDir  = Join-Path $Out 'app'

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

Set-Location $Root

# ---------------------------------------------------------------- 1. build ---
if (-not $SkipNextBuild) {
  Step 'next build (output: standalone)'
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'next build failed' }
} else {
  Step 'Skipping next build (-SkipNextBuild)'
}

$Standalone = Join-Path $Root '.next\standalone'
if (-not (Test-Path $Standalone)) { throw "No existe $Standalone. Falta output:'standalone' en next.config.ts o el build fallo." }

# --------------------------------------------------------------- 2. layout ---
Step 'Preparando dist/'
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null

Copy-Item (Join-Path $Standalone '*') $AppDir -Recurse -Force
# server.js only serves these when copied in next to it (they are not traced).
New-Item -ItemType Directory -Path (Join-Path $AppDir '.next') -Force | Out-Null
Copy-Item (Join-Path $Root '.next\static') (Join-Path $AppDir '.next\static') -Recurse -Force
if (Test-Path (Join-Path $Root 'public')) {
  Copy-Item (Join-Path $Root 'public') (Join-Path $AppDir 'public') -Recurse -Force
}

# ------------------------------------------------------------------ 3. CLI ---
# The dashboard's "iniciar sesion" button spawns this file; the packaged app
# has no tsx and no npm, so the CLI is pre-bundled to plain CommonJS.
# better-sqlite3 and playwright stay external: they are native/asset-heavy and
# already present in the traced node_modules copied above.
Step 'Compilando CLI (esbuild)'
& npx --no-install esbuild `
  'src/lib/cli/index.ts' `
  --bundle `
  --platform=node `
  --target=node22 `
  --format=cjs `
  --external:better-sqlite3 `
  --external:playwright `
  --external:playwright-core `
  --outfile="$AppDir\cli.js"
if ($LASTEXITCODE -ne 0) { throw 'esbuild (cli) failed' }

foreach ($mod in @('better-sqlite3', 'playwright', 'playwright-core')) {
  if (-not (Test-Path (Join-Path $AppDir "node_modules\$mod"))) {
    throw "Falta node_modules\$mod en el standalone. Revisa que alguna ruta del server lo importe."
  }
}

# -------------------------------------------------------------- 4. runtime ---
# The bundled node.exe must match the local major version: better-sqlite3's
# prebuilt .node binary is compiled against this Node ABI.
$NodeVer = (& node -v).Trim()
Step "Descargando runtime Node $NodeVer (win-x64)"
$RuntimeDir = Join-Path $Out 'runtime'
New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

$cacheZip = Join-Path $env:TEMP "node-$NodeVer-win-x64.zip"
if (-not (Test-Path $cacheZip)) {
  Invoke-WebRequest "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip" -OutFile $cacheZip
}
$tmpNode = Join-Path $env:TEMP "node-extract-$NodeVer"
if (Test-Path $tmpNode) { Remove-Item $tmpNode -Recurse -Force }
Expand-Archive $cacheZip -DestinationPath $tmpNode -Force
Copy-Item (Join-Path $tmpNode "node-$NodeVer-win-x64\node.exe") (Join-Path $RuntimeDir 'node.exe') -Force
Remove-Item $tmpNode -Recurse -Force

# ------------------------------------------------------------- 5. chromium ---
Step 'Copiando Chromium de Playwright'
$chromeExe = (& node -e "console.log(require('playwright').chromium.executablePath())").Trim()
if (-not (Test-Path $chromeExe)) { throw "Chromium no encontrado ($chromeExe). Ejecuta: npx playwright install chromium" }

# ...\ms-playwright\chromium-1217\chrome-win64\chrome.exe -> ms-playwright, chromium-1217
$chromiumDir = Split-Path (Split-Path $chromeExe -Parent) -Parent
$registry    = Split-Path $chromiumDir -Parent
$build       = (Split-Path $chromiumDir -Leaf) -replace '^chromium-', ''

$BrowsersDir = Join-Path $Out 'browsers'
New-Item -ItemType Directory -Path $BrowsersDir -Force | Out-Null

# chromium: headed runs (login). chromium_headless_shell: what headless:true
# actually launches since Playwright 1.49. winldd: dependency check on Windows.
$wanted = @("chromium-$build", "chromium_headless_shell-$build")
$wanted += (Get-ChildItem $registry -Directory -Filter 'winldd-*' | Select-Object -ExpandProperty Name)
foreach ($name in $wanted) {
  $src = Join-Path $registry $name
  if (Test-Path $src) {
    Write-Host "    $name"
    Copy-Item $src (Join-Path $BrowsersDir $name) -Recurse -Force
  }
}
# Playwright writes this registry file itself; copying it keeps it from
# re-downloading into the packaged folder on first launch.
if (Test-Path (Join-Path $registry '.links')) {
  Copy-Item (Join-Path $registry '.links') (Join-Path $BrowsersDir '.links') -Recurse -Force
}

# -------------------------------------------------------------- 6. launcher ---
Step 'Escribiendo launcher y documentacion'
New-Item -ItemType Directory -Path (Join-Path $Out 'data') -Force | Out-Null

$launcher = @'
@echo off
title FB Publisher - servidor (no cierres esta ventana)
setlocal
set "ROOT=%~dp0"
set "NODE_ENV=production"
set "HOSTNAME=127.0.0.1"
set "PORT=3210"
set "FB_PUBLISHER_DATA_DIR=%ROOT%data"
set "FB_PUBLISHER_CLI=%ROOT%app\cli.js"
set "PLAYWRIGHT_BROWSERS_PATH=%ROOT%browsers"
set "PLAYWRIGHT_HEADLESS=true"

if not exist "%ROOT%data" mkdir "%ROOT%data"

echo.
echo   FB Publisher
echo   ------------------------------------------------------
echo   Abriendo http://127.0.0.1:%PORT%/dashboard en tu navegador.
echo   Deja esta ventana abierta mientras uses la aplicacion.
echo   Para cerrar la aplicacion, cierra esta ventana.
echo.

start "" /min cmd /c "timeout /t 4 >nul & start "" http://127.0.0.1:%PORT%/dashboard"

cd /d "%ROOT%app"
"%ROOT%runtime\node.exe" server.js

echo.
echo   El servidor se ha detenido.
pause
'@
Set-Content -Path (Join-Path $Out 'Iniciar FB Publisher.bat') -Value $launcher -Encoding OEM

$readme = @'
FB Publisher - version portable
===============================

COMO ARRANCAR
  Doble clic en "Iniciar FB Publisher.bat".
  Se abre una ventana negra (el servidor) y el navegador con el panel.
  NO cierres la ventana negra mientras uses la aplicacion.

COMO CERRAR
  Cierra la ventana negra. Eso apaga el servidor y el planificador.

PRIMER USO
  1. Entra en "Cuentas" y crea tu cuenta de Facebook.
  2. Pulsa "Iniciar sesion": se abre una ventana de Chrome; entra en Facebook
     a mano (usuario, contrasena y verificacion si la pide).
  3. Cuando termines, cierra esa ventana de Chrome. La sesion queda guardada.
  4. Carga grupos y plantillas, crea reglas en "Ajustes" y enciende el
     planificador con el boton "Encender scheduler".

IMPORTANTE
  El planificador solo publica mientras la ventana negra este abierta y el
  equipo encendido.

TUS DATOS
  Todo (base de datos y sesiones del navegador) vive en la carpeta "data".
  Para hacer copia de seguridad, copia esa carpeta.
  Para empezar de cero, borra su contenido con la aplicacion cerrada.

NO NECESITA INSTALACION
  Node.js y Chrome van incluidos dentro de esta carpeta. Puedes moverla o
  copiarla a otro equipo Windows 64 bits tal cual.

SI EL PUERTO 3210 ESTA OCUPADO
  Edita "Iniciar FB Publisher.bat" y cambia el numero en la linea
  set "PORT=3210".
'@
Set-Content -Path (Join-Path $Out 'LEEME.txt') -Value $readme -Encoding UTF8

# ------------------------------------------------------------------ 7. zip ---
if ($Zip) {
  Step 'Comprimiendo'
  $zipPath = Join-Path $Dist 'fb-publisher-portable.zip'
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path $Out -DestinationPath $zipPath
  Write-Host "    $zipPath"
}

$size = [math]::Round((Get-ChildItem $Out -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host ""
Write-Host "Listo: $Out  ($size MB)" -ForegroundColor Green
Write-Host "Prueba local:  `"$Out\Iniciar FB Publisher.bat`"" -ForegroundColor Green
