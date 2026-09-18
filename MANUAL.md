# FB Publisher - Manual de Usuario

Herramienta para publicar anuncios en grupos de Facebook usando funciones deterministas.
Usa Playwright con `m.facebook.com` (la versión móvil ligera de Facebook) para máxima estabilidad de selectores.

---

## Tabla de contenidos

1. [Instalación y configuración](#1-instalación-y-configuración)
2. [Primer uso: iniciar sesión en Facebook](#2-primer-uso-iniciar-sesión-en-facebook)
3. [Dashboard Web](#3-dashboard-web)
4. [CLI (Línea de comandos)](#4-cli-línea-de-comandos)
5. [Gestión de Grupos](#5-gestión-de-grupos)
6. [Plantillas de anuncios](#6-plantillas-de-anuncios)
7. [Sistema de rotación determinista](#7-sistema-de-rotación-determinista)
8. [Programación automática (Scheduler)](#8-programación-automática-scheduler)
9. [Cómo funciona la publicación (m.facebook.com)](#9-cómo-funciona-la-publicación)
10. [Historial de publicaciones](#10-historial-de-publicaciones)
11. [Referencia de configuración](#11-referencia-de-configuración)
12. [Evitar detección como actividad sospechosa](#12-evitar-detección-como-actividad-sospechosa)
13. [Múltiples cuentas de Facebook](#13-múltiples-cuentas-de-facebook)

---

## 1. Instalación y configuración

> **¿Vas a usar la versión portable?** Si recibiste una carpeta con `Iniciar FB Publisher.bat`, salta esta sección completa: no necesitas Node, npm ni configurar nada. Lee el `LEEME.txt` que viene dentro y continúa en [2. Primer uso](#2-primer-uso-iniciar-sesión-en-facebook).

### Requisitos previos

- Node.js 18 o superior
- npm

### Instalación

```bash
cd fb-publisher
npm install
```

La instalación descarga automáticamente el navegador Chromium que necesita Playwright (via `postinstall`).

### Configuración inicial

Editar el archivo `.env.local` en la raíz del proyecto:

```env
# ─── Facebook Login (para Playwright) ───
FB_EMAIL=tu_email_facebook
FB_PASSWORD=tu_password_facebook

# ─── Playwright ───
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_USER_DATA_DIR=./data/browser-session

# ─── Publicación ───
RETRY_ATTEMPTS=2
RETRY_DELAY_MS=5000
```

| Variable | Descripción |
|----------|-------------|
| `FB_EMAIL` | Email de la cuenta de Facebook (opcional si haces login manual) |
| `FB_PASSWORD` | Contraseña de Facebook (opcional si haces login manual) |
| `PLAYWRIGHT_HEADLESS` | `true` = navegador invisible, `false` = visible |
| `PLAYWRIGHT_USER_DATA_DIR` | Ruta donde se guarda la sesión del navegador |
| `RETRY_ATTEMPTS` | Cuántas veces reintentar una publicación fallida |
| `RETRY_DELAY_MS` | Milisegundos de espera entre reintentos |

> **Nota:** `FB_EMAIL` y `FB_PASSWORD` son opcionales. El método recomendado es hacer login manual con el comando `login` (ver sección 2).

### Iniciar la aplicación

```bash
# Dashboard web (modo desarrollo)
npm run dev

# Dashboard web (producción)
npm run build
npm start
```

La aplicación estará disponible en **http://localhost:3000**.

---

## 2. Primer uso: iniciar sesión en Facebook

Antes de publicar, necesitas iniciar sesión en Facebook para que la herramienta guarde la sesión del navegador.

### Login manual (recomendado)

```bash
npm run cli -- login
```

Si manejas varias cuentas de Facebook, agrega `--account <id>` (ver [sección 13](#13-múltiples-cuentas-de-facebook)). Sin ese flag, todos los comandos operan sobre la cuenta `default` (la única que existe si no has creado ninguna otra).

Esto:
1. Abre un navegador visible en `m.facebook.com`
2. Tú inicias sesión manualmente con tu cuenta de Facebook
3. La sesión se guarda automáticamente en `data/browser-session/`
4. Cierras el navegador cuando termines

**La sesión persiste entre ejecuciones.** No necesitas volver a hacer login a menos que Facebook cierre la sesión (lo cual puede pasar después de varias semanas o si cambias la contraseña).

### Login automático (alternativo)

Si configuras `FB_EMAIL` y `FB_PASSWORD` en `.env.local`, la herramienta intentará hacer login automáticamente cuando no encuentre una sesión activa. Sin embargo, esto puede fallar si Facebook pide verificación por SMS/2FA.

### Verificar que la sesión funciona

Después del login, puedes hacer una publicación de prueba para verificar:

```bash
# 1. Agregar un grupo de prueba
npm run cli -- groups add "Mi grupo" "https://www.facebook.com/groups/123456789"

# 2. Crear una plantilla simple
npm run cli -- templates add "Test" "Hola, esto es una prueba"

# 3. Ver los IDs creados
npm run cli -- groups list
npm run cli -- templates list

# 4. Publicar (reemplazar con tus IDs)
npm run cli -- publish <groupId> <templateId>
```

---

## 3. Dashboard Web

El dashboard web tiene 6 secciones accesibles desde el menú lateral (Overview, Cuentas, Grupos, Plantillas, Publicaciones, Configuración).

> **Sin autenticación propia.** El dashboard no tiene login — cualquiera con acceso a la URL puede crear/eliminar grupos, cuentas, abrir un navegador de login o encender el scheduler. Correcto para uso local o en red confiable; si esto se expone a internet, hace falta agregar autenticación antes.

### Overview (Página principal)

Muestra un resumen general con:

- **Grupos activos**: Cuántos grupos están configurados y activos.
- **Plantillas**: Total de plantillas de anuncios creadas.
- **Publicaciones hoy**: Cantidad de publicaciones realizadas en el día.
- **Tasa de éxito**: Porcentaje de publicaciones exitosas.
- **Publicaciones recientes**: Las últimas 5 publicaciones con su estado.

### Navegación

| Sección | Ruta | Descripción |
|---------|------|-------------|
| Overview | `/dashboard` | Resumen general |
| Grupos | `/dashboard/groups` | Gestionar grupos de Facebook |
| Plantillas | `/dashboard/templates` | Crear y editar plantillas |
| Publicaciones | `/dashboard/publications` | Historial de publicaciones |
| Configuración | `/dashboard/settings` | Reglas de programación |

---

## 4. CLI (Línea de comandos)

El CLI permite operar la herramienta desde la terminal sin necesidad del dashboard.

### Uso general

```bash
npm run cli -- <comando> [opciones]
```

### Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `accounts list` | Listar cuentas de Facebook configuradas |
| `accounts add <nombre> [--proxy <url>]` | Agregar una cuenta (proxy opcional) |
| `accounts remove <id>` | Eliminar una cuenta |
| `login` | Abrir navegador para iniciar sesión en Facebook |
| `status` | Ver estado general del sistema |
| `groups list` | Listar todos los grupos |
| `groups add <nombre> <url>` | Agregar un grupo |
| `groups remove <id>` | Eliminar un grupo |
| `templates list` | Listar todas las plantillas |
| `templates add <nombre> <cuerpo>` | Crear una plantilla |
| `templates remove <id>` | Eliminar una plantilla |
| `preview <templateId> [índice]` | Vista previa de una plantilla |
| `publish <groupId> <templateId>` | Publicar manualmente |
| `publish --all` | Publicar en todos los grupos activos |
| `schedule list` | Listar reglas de programación |
| `schedule start` | Iniciar el scheduler automático (todas las cuentas activas) |
| `schedule trigger <ruleId>` | Ejecutar una regla manualmente |
| `schedule stop` | Detener el scheduler |

### Opciones

| Opción | Descripción |
|--------|-------------|
| `--account <id>` | Cuenta a usar (ver [sección 13](#13-múltiples-cuentas-de-facebook)); por defecto `default` |
| `--rotation <número>` | Índice de rotación específico |
| `--no-headless` | Mostrar ventana del navegador |

### Ejemplos

```bash
# Iniciar sesión en Facebook (primer uso)
npm run cli -- login

# Ver estado del sistema
npm run cli -- status

# Agregar un grupo
npm run cli -- groups add "Ventas Bogotá" "https://www.facebook.com/groups/123456789"

# Crear una plantilla simple
npm run cli -- templates add "Oferta" "Producto disponible. Contactar al 300-123-4567"

# Vista previa de una plantilla con rotación #5
npm run cli -- preview abc123-template-id 5

# Publicar manualmente
npm run cli -- publish grupo-id template-id

# Publicar en todos los grupos activos
npm run cli -- publish --all

# Iniciar publicación automática
npm run cli -- schedule start
```

---

## 5. Gestión de Grupos

### Desde el Dashboard

1. Ir a **Grupos** en el menú lateral.
2. Clic en **"+ Agregar grupo"**.
3. Completar el formulario:
   - **Nombre**: Nombre descriptivo del grupo (ej: "Ventas Bogotá").
   - **URL del grupo**: Pegar la URL completa del grupo de Facebook. El ID del grupo se extrae automáticamente.
   - **Categoría** (opcional): Para organizar los grupos (ej: "Ventas", "Servicios").
   - **Máx. publicaciones/día**: Límite diario por grupo (default: 3).
   - **Cooldown (minutos)**: Tiempo mínimo entre publicaciones al mismo grupo (default: 60).
4. Clic en **"Crear grupo"**.

### Desde el CLI

```bash
npm run cli -- groups add "Nombre del grupo" "https://www.facebook.com/groups/123456789"
```

El ID del grupo se extrae automáticamente de la URL. Si la URL contiene el nombre del grupo en vez del ID numérico, ingrésalo manualmente.

### Parámetros de control por grupo

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| Máx. publicaciones/día | 3 | Evita saturar un grupo con demasiados posts |
| Cooldown (minutos) | 60 | Tiempo mínimo de espera entre posts al mismo grupo |
| Activo/Inactivo | Activo | Grupos inactivos son ignorados por el scheduler |

### Acciones sobre un grupo

- **Activar/Desactivar**: Pausa las publicaciones sin eliminar el grupo.
- **Editar**: Modificar cualquier parámetro.
- **Eliminar**: Elimina el grupo permanentemente.
- **Verificar membresía**: abre una sesión real de Playwright contra `m.facebook.com/groups/{id}` y detecta si la cuenta es miembro (`Miembro`), no lo es (`No miembro`), tiene una solicitud pendiente de aprobación (`Solicitud pendiente`), o hubo un error de red/carga (`Error al verificar`). El resultado y la fecha de verificación quedan guardados en el grupo. **Importante:** este chequeo detecta si el bot puede *ver* el grupo como miembro, pero no es instantáneo — usa el mismo navegador real, así que tarda unos segundos por grupo. Úsalo antes de activar una regla de programación para un grupo nuevo.

---

## 6. Plantillas de anuncios

Las plantillas definen el contenido de los anuncios usando variables reemplazables.

### Crear una plantilla

1. Ir a **Plantillas** en el menú lateral.
2. Clic en **"+ Nueva plantilla"**.
3. Completar:
   - **Nombre**: Nombre descriptivo.
   - **Contenido**: El texto del anuncio con variables entre `{{dobles llaves}}`.
   - **Variables**: Definir cada variable con sus posibles valores.
   - **Tags** (opcional): Para categorizar plantillas.

### Sintaxis de variables

Las variables se escriben con la sintaxis `{{nombreVariable}}` dentro del cuerpo de la plantilla. También se tolera espacio dentro de las llaves (`{{ nombreVariable }}`), por si copiás el texto de otro lado con ese formato.

**Ejemplo de plantilla:**

```
OFERTA ESPECIAL

{{producto}} disponible en {{ubicacion}}
Precio: {{precio}}

Contacto: {{telefono}}
No te lo pierdas!
```

### Tipos de variables

| Tipo | Descripción | Ejemplo de valores |
|------|-------------|--------------------|
| Texto | Texto libre | `iPhone 15, Samsung S24, Xiaomi 14` |
| Número | Valores numéricos | `100, 200, 300` |
| Precio | Se formatea con `$` automáticamente | `500.000, 750.000, 1.200.000` |
| Lista | Lista de opciones | `Bogotá, Medellín, Cali` |

### Definir valores de variable

Al agregar una variable, se ingresan los posibles valores separados por comas:

```
Nombre: producto
Tipo: Texto
Valores: iPhone 15, Samsung Galaxy S24, Xiaomi 14 Pro
```

```
Nombre: ubicacion
Tipo: Lista
Valores: Bogotá Norte, Bogotá Sur, Chapinero, Suba
```

### Vista previa

El botón **"Preview"** en cada plantilla muestra cómo se ve el anuncio renderizado. Los botones **"Anterior"** y **"Siguiente"** permiten navegar por las rotaciones para ver todas las combinaciones de variables.

Desde el CLI:

```bash
npm run cli -- preview <templateId> 0    # primera combinación
npm run cli -- preview <templateId> 1    # segunda combinación
npm run cli -- preview <templateId> 5    # sexta combinación
```

---

## 7. Sistema de rotación determinista

Este es el núcleo de la herramienta. La rotación determinista garantiza que:

- **Dado un mismo índice, siempre se genera el mismo contenido.** No hay aleatoriedad.
- **Todas las combinaciones se usan antes de repetir.** Distribución uniforme.
- **El avance es predecible.** Puedes saber exactamente qué se publicará en cada momento.

### Cómo funciona

Cada variable tiene N valores posibles. El sistema calcula todas las combinaciones posibles y las recorre secuencialmente usando aritmética modular (como un odómetro).

**Ejemplo:**

Con las variables:
- `producto`: iPhone, Samsung, Xiaomi (3 valores)
- `ubicacion`: Norte, Sur (2 valores)

Total de combinaciones: 3 x 2 = **6 combinaciones únicas**

| Rotación | producto | ubicacion |
|----------|----------|-----------|
| #0 | iPhone | Norte |
| #1 | Samsung | Norte |
| #2 | Xiaomi | Norte |
| #3 | iPhone | Sur |
| #4 | Samsung | Sur |
| #5 | Xiaomi | Sur |
| #6 | iPhone | Norte | (ciclo se repite) |

### Rotación en el scheduler

Cuando se configura una regla de programación, el sistema mantiene un **índice de rotación** que avanza con cada publicación. Este índice también rota entre las combinaciones de plantillas y grupos, distribuyendo las publicaciones de manera uniforme.

El índice avanza siempre, incluso si la publicación falla, para evitar reintentar el mismo contenido repetidamente.

---

## 8. Programación automática (Scheduler)

El scheduler permite configurar publicaciones automáticas usando expresiones cron.

> **⚠️ Crear una regla aquí no la ejecuta.** El dashboard solo guarda la configuración de la regla (grupos, plantillas, cron, jitter). Para que efectivamente se publique sola hace falta encender el scheduler, con cualquiera de estas dos formas equivalentes:
>
> - **Botón en el dashboard**: en Configuración, botón "Encender scheduler" (junto al punto de estado ● Corriendo / ○ Detenido). Aplica a todas las cuentas con reglas activas, no solo a la seleccionada. Confiable corriendo `npm run build && npm start` (producción); en `npm run dev` puede reiniciarse si se edita el código del servidor mientras está encendido.
> - **Terminal aparte**: `npm run cli -- schedule start` — ese proceso queda bloqueado ejecutándose. Los dos métodos comparten el mismo estado (arrancar por uno se refleja en el otro).
>
> Si apagás el scheduler (o cerrás la terminal que lo tenía corriendo), las reglas siguen apareciendo como "Activo" en el dashboard pero no publican nada.

### Crear una regla de programación

1. Ir a **Configuración** en el menú lateral.
2. Clic en **"+ Nueva regla"**.
3. Configurar:
   - **Nombre**: Nombre descriptivo (ej: "Publicación diaria ventas").
   - **Grupos**: Seleccionar en qué grupos publicar.
   - **Plantillas**: Seleccionar qué plantillas usar.
   - **Frecuencia**: Elegir un preset o escribir una expresión cron personalizada.
   - **Aplicar demora aleatoria (jitter)**: casilla activada por defecto. Con ella activa, la regla espera un tiempo aleatorio (`SCHEDULER_JITTER_MIN/MAX_MINUTES`, sección 11) después de cada disparo de cron antes de publicar, para no parecer bot. Desactivarla solo para pruebas donde interesa que publique apenas llega la hora exacta.
   - **Zona horaria**: Seleccionar la zona horaria. El dashboard recuerda la última zona horaria usada (guardada en el navegador) y la pre-selecciona la próxima vez que creás una regla.
4. Clic en **"Crear regla de programación"**.

La lista de reglas debajo del formulario muestra, por cada una, el cron, la zona horaria, cuántos grupos y plantillas usa, el índice de rotación actual y si el jitter está `on` u `off`.

### Presets de frecuencia

| Preset | Expresión cron | Descripción |
|--------|---------------|-------------|
| 3x al día | `0 9,14,19 * * *` | A las 9am, 2pm y 7pm |
| 2x al día | `0 10,18 * * *` | A las 10am y 6pm |
| Cada hora (9-21h) | `0 9-21 * * *` | Cada hora de 9am a 9pm |
| Lunes a viernes 9h | `0 9 * * 1-5` | Solo días laborables a las 9am |

### Expresiones cron personalizadas

Formato: `minuto hora día-del-mes mes día-de-la-semana`

| Campo | Valores | Especial |
|-------|---------|----------|
| Minuto | 0-59 | `*` = todos, `,` = lista, `-` = rango |
| Hora | 0-23 | Igual |
| Día del mes | 1-31 | Igual |
| Mes | 1-12 | Igual |
| Día de la semana | 0-7 (0 y 7 = domingo) | Igual |

**Ejemplos:**

```
0 9,14,19 * * *       -> 9am, 2pm, 7pm todos los días
30 8 * * 1-5          -> 8:30am de lunes a viernes
0 */2 * * *           -> Cada 2 horas
0 10 * * 1,3,5        -> 10am los lunes, miércoles y viernes
```

### Iniciar el scheduler desde CLI

```bash
npm run cli -- schedule start
```

El scheduler se ejecuta en primer plano y muestra logs de cada publicación. Presionar `Ctrl+C` para detenerlo.

### Qué hace el scheduler en cada ejecución

1. **Selecciona** la combinación plantilla + grupo según el índice de rotación.
2. **Verifica** que el grupo no esté en cooldown.
3. **Verifica** que no se haya excedido el límite diario del grupo.
4. **Renderiza** la plantilla con los valores deterministas.
5. **Publica** via `m.facebook.com` usando Playwright.
6. **Registra** el resultado en el historial.
7. **Avanza** el índice de rotación.

---

## 9. Cómo funciona la publicación

### m.facebook.com

La herramienta usa `m.facebook.com`, la versión móvil ligera de Facebook ("weblite"). Originalmente se diseñó contra `mbasic.facebook.com` (la versión HTML estática clásica), pero Meta la retiró — hoy `mbasic.facebook.com` redirige automáticamente a `m.facebook.com`. A diferencia de mbasic, weblite no usa formularios HTML planos: despacha clics vía atributos `data-action-id` y el compositor de posts es un editor de texto enriquecido Lexical (`[role="textbox"][contenteditable="true"]`), el mismo framework que usa Meta en WhatsApp/Instagram Web.

**Por qué sigue siendo más estable que la interfaz completa:**

- Servidor-renderizado (no una SPA de React completa), sin bundle JS pesado.
- El botón de publicar sigue siendo identificable de forma semántica (`[role="button"]` con texto "POST"), sin depender de nombres de clase generados.

**Selectores utilizados:**

| Paso | Selector | Función |
|------|----------|---------|
| Abrir compositor | `span` con texto "Write something..." (busca el contenedor con `data-action-id` ancestro) | Navega a `/composer/` |
| Escribir texto | `[role="textbox"][contenteditable="true"]` (editor Lexical) | Campo de texto del post — se escribe con eventos de teclado reales, no `.fill()` |
| Adjuntar foto | texto "Photos" → `input[type="file"]` (oculto) | Sube la imagen |
| Publicar | `[role="button"]` con texto "POST" (el último de los dos que aparecen en la página) | Envía el post |

### Flujo de publicación

1. El navegador (Chromium) se abre con la sesión guardada, con un User-Agent móvil Android.
2. Navega a `https://m.facebook.com/groups/{groupId}` y espera unos segundos (simula lectura).
3. Hace clic en "Write something..." → navega a `/composer/`.
4. Escribe el contenido con velocidad de tecleo variable en el editor Lexical.
5. Si hay imagen, hace clic en "Photos", sube el archivo.
6. Hace clic en el botón "POST".
7. Espera a que la página redirija de vuelta al grupo (confirma el envío) y cierra el navegador.

### Limitaciones

- **1 imagen por publicación**: al igual que antes, solo se sube una imagen por post.
- **Sesión**: puede expirar después de varias semanas. Si las publicaciones empiezan a fallar, ejecutar `npm run cli -- login` de nuevo.
- **2FA**: si tu cuenta tiene autenticación de dos factores, debes hacer el login manual.
- **Aprobación de admin**: muchos grupos moderados retienen los posts de miembros para revisión — un post "exitoso" (sin error) puede quedar pendiente de aprobación antes de ser visible públicamente. Ver sección 12.
- **Markup frágil**: al no haber atributos `name` estables como en mbasic, Meta puede cambiar la estructura de weblite sin aviso. Si la publicación empieza a fallar con errores `COMPOSER_TRIGGER_NOT_FOUND` o `COMPOSER_TEXTBOX_NOT_FOUND`, revisar `src/lib/publishers/playwright-publisher.ts`.

---

## 10. Historial de publicaciones

### Desde el Dashboard

La sección **Publicaciones** muestra el historial completo con:

> Esta pantalla se actualiza sola cada 4 segundos (se ve un aviso "se actualiza sola cada 4s" junto al título) — no hace falta recargar la página para ver publicaciones nuevas del scheduler.

- **Contenido**: El texto que se publicó.
- **Estado**: El resultado de la publicación.
- **Intentos**: Cuántas veces se intentó publicar.
- **Fecha**: Cuándo se publicó o programó.

### Filtros

Se puede filtrar por estado:
- **Todas**: Todas las publicaciones.
- **Success**: Publicaciones exitosas.
- **Failed**: Publicaciones que fallaron.
- **Pending**: Publicaciones pendientes.

### Estados de publicación

| Estado | Descripción |
|--------|-------------|
| `pending` | Programada, esperando ejecución |
| `publishing` | En proceso de publicación |
| `success` | Publicada exitosamente |
| `failed` | Falló la publicación |
| `retry` | Falló y se va a reintentar |

---

## 11. Referencia de configuración

### Variables de entorno (.env.local)

| Variable | Tipo | Default | Descripción |
|----------|------|---------|-------------|
| `FB_EMAIL` | string | `""` | Email para login automático (opcional) |
| `FB_PASSWORD` | string | `""` | Password para login automático (opcional) |
| `PLAYWRIGHT_HEADLESS` | boolean | `true` | Navegador invisible |
| `PLAYWRIGHT_USER_DATA_DIR` | string | `./data/browser-session` | Ruta de sesión del navegador de la cuenta `default` (las demás cuentas usan `data/browser-sessions/{id}/` automáticamente) |
| `RETRY_ATTEMPTS` | number | `2` | Intentos de reintento |
| `RETRY_DELAY_MS` | number | `5000` | Milisegundos entre reintentos |
| `SCHEDULER_JITTER_MIN_MINUTES` | number | `0` | Espera aleatoria mínima (min) tras cada disparo de cron antes de publicar |
| `SCHEDULER_JITTER_MAX_MINUTES` | number | `20` | Espera aleatoria máxima (min) tras cada disparo de cron antes de publicar |
| `SCHEDULER_GLOBAL_MIN_GAP_MINUTES` | number | `8` | Espaciado mínimo entre posts de la MISMA cuenta, sin importar el grupo |
| `SCHEDULER_MAX_POSTS_PER_DAY_TOTAL` | number | `12` | Tope diario de publicaciones exitosas POR cuenta |
| `SCHEDULER_CROSS_ACCOUNT_MIN_GAP_MINUTES` | number | `3` | Espaciado mínimo entre posts de cuentas DISTINTAS (ver [sección 13](#13-múltiples-cuentas-de-facebook)) |

### Base de datos

La aplicación usa SQLite. La base de datos se crea automáticamente en:

```
data/fb-publisher.db
```

No requiere configuración adicional.

### Estructura del proyecto

```
fb-publisher/
├── .env.local              # Configuración (credenciales)
├── data/                   # Datos persistentes (gitignored)
│   ├── fb-publisher.db     # SQLite (se crea automáticamente)
│   └── browser-session/    # Sesión de Playwright (se crea con login)
├── src/
│   ├── lib/
│   │   ├── types.ts        # Tipos TypeScript
│   │   ├── config.ts       # Lectura de configuración
│   │   ├── db/             # Base de datos y repositorios
│   │   ├── templates/      # Motor de plantillas determinista
│   │   ├── publishers/     # Publisher con Playwright + m.facebook.com
│   │   ├── scheduler/      # Programación con cron
│   │   └── cli/            # Interfaz de línea de comandos
│   └── app/
│       ├── api/            # API REST (Next.js routes)
│       └── dashboard/      # Interfaz web
└── package.json
```

### API REST

Todos los endpoints aceptan y retornan JSON.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/groups` | Listar grupos |
| POST | `/api/groups` | Crear grupo |
| GET | `/api/groups/:id` | Obtener grupo |
| PUT | `/api/groups/:id` | Actualizar grupo |
| DELETE | `/api/groups/:id` | Eliminar grupo |
| GET | `/api/templates` | Listar plantillas |
| POST | `/api/templates` | Crear plantilla |
| GET | `/api/templates/:id` | Obtener plantilla |
| PUT | `/api/templates/:id` | Actualizar plantilla |
| DELETE | `/api/templates/:id` | Eliminar plantilla |
| POST | `/api/templates/preview` | Vista previa de plantilla |
| GET | `/api/publications` | Listar publicaciones |
| GET | `/api/scheduler` | Listar reglas |
| POST | `/api/scheduler` | Crear regla |
| GET | `/api/scheduler/:id` | Obtener regla |
| PUT | `/api/scheduler/:id` | Actualizar regla |
| DELETE | `/api/scheduler/:id` | Eliminar regla |

### Guía rápida de inicio

```bash
# 1. Instalar
npm install

# 2. Iniciar sesión en Facebook
npm run cli -- login

# 3. Agregar grupos
npm run cli -- groups add "Mi grupo" "https://facebook.com/groups/123"

# 4. Crear plantillas
npm run cli -- templates add "Anuncio" "Texto del anuncio"

# 5. Publicar
npm run cli -- publish <groupId> <templateId>

# 6. O iniciar el dashboard web
npm run dev
```

---

## 12. Evitar detección como actividad sospechosa

El scheduler ya aplica automáticamente (ver variables en la sección 11):

- **Jitter aleatorio**: cada publicación programada espera un tiempo aleatorio (`SCHEDULER_JITTER_MIN/MAX_MINUTES`) antes de ejecutarse, para no publicar siempre a la hora exacta del cron.
- **Espaciado global mínimo** (`SCHEDULER_GLOBAL_MIN_GAP_MINUTES`): nunca publica dos posts (en cualquier grupo) más seguido que este intervalo, evitando ráfagas.
- **Tope diario total de la cuenta** (`SCHEDULER_MAX_POSTS_PER_DAY_TOTAL`), independiente del límite por grupo.
- **Tipeo con velocidad variable** y pausas ocasionales, en vez de tipeo a ritmo constante.
- **Tiempo de lectura simulado**: espera unos segundos tras cargar la página del grupo antes de interactuar, como haría una persona.

Lo que el código **no puede resolver por sí solo** — decisiones que dependen de ti:

- **No agregues los 10 grupos al scheduler el primer día.** Empieza con 1-2 grupos donde ya seas miembro activo (con tiempo, comentarios/likes previos), y ve sumando el resto gradualmente en el curso de semanas. Una cuenta nueva en un grupo que empieza a postear de inmediato y seguido es la señal más fuerte de spam para Facebook y para los moderadores humanos.
- **Respeta la cola de aprobación.** Si un grupo tiene "Pending admin approval" activado (ver sección 9), no lo satures con más posts mientras uno sigue pendiente — parece ignorar la moderación.
- **Varía el contenido real, no solo la plantilla.** Publicar el mismo texto (aunque rotado con variables) en los 10 grupos el mismo día es un patrón de cross-posting detectable. Preferible: contenido distinto por grupo, o al menos con más separación temporal entre grupos similares.
- **Interactúa como cuenta real de vez en cuando** (dar like, comentar en otros posts) fuera del flujo automatizado — una cuenta que solo publica y nunca interactúa de otra forma es un patrón atípico.
- **Un solo dispositivo/sesión por cuenta.** No mezcles la sesión de una cuenta (`data/browser-sessions/{id}/`) con logins simultáneos desde otro navegador o dispositivo — accesos concurrentes desde ubicaciones o huellas de navegador distintas es una señal clásica de compromiso de cuenta que Facebook vigila activamente.
- **No cambies user-agent, ubicación o IP entre ejecuciones de la misma cuenta.** El User-Agent móvil fijo y el mismo perfil persistente ya ayudan; no rotes el proxy de una cuenta pensando que "oculta" la automatización — para una cuenta dada, cambiar de IP frecuentemente es más sospechoso que mantener una IP estable. Si manejas varias cuentas, cada una necesita su propia IP fija, no una IP compartida ni una rotativa (ver [sección 13](#13-múltiples-cuentas-de-facebook)).

---

## 13. Múltiples cuentas de Facebook

Cada cuenta tiene su propio proxy fijo y su propia sesión de navegador — están completamente aisladas entre sí (grupos, plantillas, historial y programaciones distintos).

### Desde el dashboard

En el sidebar hay un selector **"Cuenta activa"** arriba de la navegación: cambia qué cuenta ven y editan Grupos, Plantillas, Publicaciones, Configuración y el Overview. La pantalla **Cuentas** (ícono 🔑) permite crear, editar (incluyendo el proxy) y eliminar cuentas sin tocar la terminal. El login inicial de cada cuenta sigue siendo manual por CLI (ver más abajo) — el dashboard no puede abrir un navegador visible.

### Desde el CLI

### Por qué proxy por cuenta

Facebook vincula cuentas que comparten señales: misma IP, mismo fingerprint de navegador, mismos horarios de publicación. Si dos cuentas publican desde la misma IP, Meta las asocia como "red de cuentas" — si una cae en revisión, arrastra a las demás. Por eso cada cuenta nueva necesita una **IP fija propia** (no rotativa: cambiar de IP seguido en una misma cuenta es tan sospechoso como compartir IP entre cuentas).

### Crear una cuenta

```bash
npm run cli -- accounts add "Cuenta Ventas Norte" --proxy http://usuario:clave@1.2.3.4:8080
npm run cli -- accounts list
```

El proxy es opcional al crear la cuenta — sin él, esa cuenta sale a internet con la IP de la máquina donde corre la herramienta (correcto solo para una única cuenta, o la cuenta `default`).

### Login por cuenta

Desde el dashboard: en **Cuentas**, botón **"Iniciar sesión"** en la tarjeta de la cuenta. Por CLI, equivalente:

```bash
npm run cli -- login --account <id>
```

Cualquiera de las dos formas abre un navegador visible (ya usando el proxy asignado), inicias sesión manualmente, y la sesión queda guardada en `data/browser-sessions/<id>/` — aislada de las demás cuentas.

> **⚠️ El navegador se abre en la máquina donde corre el servidor Next.js, no en la tuya.** Si estás mirando el dashboard desde otra computadora (por ejemplo, la app corre en un servidor y vos la abrís desde tu laptop), el botón "Iniciar sesión" abre Chromium en el servidor — no vas a verlo. En ese caso hay que usar el CLI directamente en la máquina donde corre la app (o acceso remoto a su escritorio). El botón solo tiene sentido para uso local, con la app y el navegador en la misma máquina que estás mirando.

### Operar una cuenta específica

Todos los comandos de grupos, plantillas y publicación manual aceptan `--account <id>`:

```bash
npm run cli -- groups add "Grupo X" "https://facebook.com/groups/123" --account <id>
npm run cli -- templates add "Anuncio" "Texto..." --account <id>
npm run cli -- publish <groupId> <templateId> --account <id>
```

Sin `--account`, todos estos comandos operan sobre la cuenta `default`.

### Scheduler con varias cuentas

```bash
npm run cli -- schedule start
```

Un solo `schedule start` levanta las reglas de **todas** las cuentas activas a la vez, cada una publicando con su propia sesión y proxy. Además de los límites por cuenta (tope diario, espaciado mínimo — sección 11), el scheduler aplica un espaciado mínimo *entre cuentas distintas* (`SCHEDULER_CROSS_ACCOUNT_MIN_GAP_MINUTES`, default 3 minutos) para que dos cuentas no publiquen en el mismo instante, aunque cada una tenga su propio proxy.

### Lo que no resuelve el código

- **Credenciales de Facebook no se guardan.** El login de cada cuenta nueva sigue siendo manual la primera vez (y si la sesión expira).
- **El proxy debe ser fijo y de calidad** (residencial o datacenter reputado) — un proxy compartido con otros usuarios o de mala reputación puede ser tan detectable como no tener proxy.
- **El ritmo de calentamiento de cada cuenta nueva sigue siendo manual** (sección 12): no le asignes a una cuenta recién creada 10 grupos desde el día uno solo porque ahora es técnicamente posible.
