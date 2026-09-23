# FB Publisher

Herramienta para automatizar publicaciones en grupos de Facebook, con rotación determinista de contenido, dashboard web y CLI. Usa Playwright contra `m.facebook.com` (la versión móvil ligera de Facebook) para publicar sin depender de la API oficial de grupos de Facebook, que Meta restringe fuertemente para este caso de uso.

> Documentación completa de uso: [MANUAL.md](./MANUAL.md)

## Capturas

| Dashboard | Grupos |
|---|---|
| ![Overview](docs/screenshots/overview.png) | ![Grupos](docs/screenshots/groups.png) |

| Plantillas | Programación |
|---|---|
| ![Plantillas](docs/screenshots/templates.png) | ![Configuración](docs/screenshots/settings.png) |

| Publicaciones |
|---|
| ![Publicaciones](docs/screenshots/publications.png) |

## Características

- **Dashboard web** (Next.js) para gestionar grupos, plantillas, programación y ver historial de publicaciones — sin tocar código ni JSON.
- **CLI** para operar todo desde terminal (`login`, `groups`, `templates`, `publish`, `schedule`).
- **Rotación determinista de contenido**: cada plantilla admite variables (`{{producto}}`, `{{precio}}`, etc.) y el sistema recorre todas las combinaciones posibles antes de repetir — sin aleatoriedad, siempre reproducible.
- **Scheduler con cron**: reglas de programación por grupo/plantilla con expresiones cron o presets ("3x al día", "cada hora", etc.).
- **Verificación de membresía**: detecta si la cuenta ya es miembro de cada grupo antes de intentar publicar ahí.
- **Comportamiento anti-detección**: jitter aleatorio entre publicaciones, espaciado global mínimo, tope diario de cuenta, y tecleo con velocidad humana variable — para no verse como actividad de bot. Ver [sección 12 del manual](./MANUAL.md#12-evitar-detección-como-actividad-sospechosa).
- **Múltiples cuentas de Facebook**: cada cuenta con su propio proxy fijo y sesión de navegador aislada. Se administran desde el dashboard (pantalla "Cuentas" + selector en el sidebar) o por CLI (`accounts add/list/remove`, flag `--account`). Ver [sección 13 del manual](./MANUAL.md#13-múltiples-cuentas-de-facebook).

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + Tailwind CSS 4
- [Playwright](https://playwright.dev) para automatización de navegador
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) para persistencia local
- [node-cron](https://github.com/node-cron/node-cron) para el scheduler

## Instalación rápida

```bash
npm install                # instala dependencias y descarga Chromium (postinstall)
cp .env.local.example .env.local  # si no existe, crear y completar credenciales/config
npm run cli -- login       # abre un navegador para iniciar sesión manual en Facebook
npm run dev                # dashboard en http://localhost:3000
```

Ver la [guía completa de instalación y primer uso](./MANUAL.md#1-instalación-y-configuración) en el manual.

> **Nota:** crear reglas de programación desde el dashboard no las ejecuta solas — hace falta dejar corriendo aparte `npm run cli -- schedule start` (ver [sección 8 del manual](./MANUAL.md#8-programación-automática-scheduler)).

## Empaquetar para un usuario final

Genera una carpeta portable para Windows 64 bits que **no requiere Node, npm ni Playwright** en la máquina destino:

```bash
npm run package        # equivale a: powershell -ExecutionPolicy Bypass -File scripts/build-dist.ps1
```

Resultado en `dist/fb-publisher/` (~795 MB en disco, ~340 MB comprimido):

```
fb-publisher/
├── Iniciar FB Publisher.bat   # launcher: arranca el server y abre el dashboard
├── LEEME.txt                  # instrucciones para el usuario final
├── app/                       # build standalone de Next + cli.js compilado
├── runtime/node.exe           # Node embebido (misma versión que la de build)
├── browsers/                  # Chromium + headless shell de Playwright
└── data/                      # SQLite y sesiones del navegador (se llena al usar)
```

Flags del script:

- `-SkipNextBuild` — reutiliza el `.next` existente (iteración rápida del empaquetado).
- `-Zip` — genera además `dist/fb-publisher-portable.zip` para enviárselo al usuario.

Notas:

- El `node.exe` embebido se descarga con la **misma versión exacta** que el Node local, porque el binario nativo de `better-sqlite3` está compilado contra ese ABI. Si cambias de versión de Node, vuelve a ejecutar `npm install` antes de empaquetar.
- El launcher fija `FB_PUBLISHER_DATA_DIR`, `PLAYWRIGHT_BROWSERS_PATH` y `FB_PUBLISHER_CLI`, de modo que todo el estado vive en `data/` y el botón "iniciar sesión" del dashboard lanza el CLI compilado en vez de `npm run cli`.
- El scheduler corre dentro del proceso del servidor: solo publica mientras la ventana del launcher siga abierta.
- El paquete no incluye `.env.local` ni la carpeta `data/` de desarrollo: el trazador de Next arrastraba `data/` (con la sesión de Facebook del desarrollador) al standalone, y ahora se excluye en `next.config.ts` y se borra en el script.
- `playwright`, `playwright-core` y `better-sqlite3` se copian completos desde `node_modules`: el trazador solo conserva los archivos que alcanza la entrada ESM, lo que deja `require('playwright')` (el CLI compilado) sin resolver.

## Estructura del proyecto

```
fb-publisher/
├── data/                   # SQLite + sesión de Playwright (gitignored)
├── src/
│   ├── lib/
│   │   ├── db/              # SQLite y repositorios
│   │   ├── templates/       # Motor de plantillas determinista
│   │   ├── publishers/      # Publisher con Playwright + m.facebook.com
│   │   ├── scheduler/       # Programación con cron
│   │   └── cli/             # Interfaz de línea de comandos
│   └── app/
│       ├── api/              # API REST (Next.js routes)
│       └── dashboard/         # Interfaz web
└── MANUAL.md                # Manual de usuario completo
```

## Advertencia

Esta herramienta automatiza acciones sobre una cuenta real de Facebook mediante control de navegador (no la API oficial). Facebook puede cambiar la estructura de `m.facebook.com` sin aviso, y usar automatización de forma agresiva puede resultar en revisiones de seguridad o restricciones de la cuenta. Lee la sección de buenas prácticas del manual antes de programar publicaciones automáticas a gran escala.
