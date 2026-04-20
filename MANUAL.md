# FB Publisher - Manual de Usuario

Herramienta para publicar anuncios en grupos de Facebook usando funciones deterministas.
Usa Playwright con `mbasic.facebook.com` (la versión HTML estática de Facebook) para máxima estabilidad de selectores.

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
9. [Cómo funciona la publicación (mbasic.facebook.com)](#9-cómo-funciona-la-publicación)
10. [Historial de publicaciones](#10-historial-de-publicaciones)
11. [Referencia de configuración](#11-referencia-de-configuración)

---

## 1. Instalación y configuración

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

Esto:
1. Abre un navegador visible en `mbasic.facebook.com`
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

El dashboard web tiene 5 secciones accesibles desde el menú lateral:

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
| `schedule start` | Iniciar el scheduler automático |
| `schedule trigger <ruleId>` | Ejecutar una regla manualmente |
| `schedule stop` | Detener el scheduler |

### Opciones

| Opción | Descripción |
|--------|-------------|
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

Las variables se escriben con la sintaxis `{{nombreVariable}}` dentro del cuerpo de la plantilla.

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

### Crear una regla de programación

1. Ir a **Configuración** en el menú lateral.
2. Clic en **"+ Nueva regla"**.
3. Configurar:
   - **Nombre**: Nombre descriptivo (ej: "Publicación diaria ventas").
   - **Grupos**: Seleccionar en qué grupos publicar.
   - **Plantillas**: Seleccionar qué plantillas usar.
   - **Frecuencia**: Elegir un preset o escribir una expresión cron personalizada.
   - **Zona horaria**: Seleccionar la zona horaria.
4. Clic en **"Crear regla de programación"**.

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
5. **Publica** via `mbasic.facebook.com` usando Playwright.
6. **Registra** el resultado en el historial.
7. **Avanza** el índice de rotación.

---

## 9. Cómo funciona la publicación

### mbasic.facebook.com

La herramienta usa `mbasic.facebook.com` en lugar de la interfaz moderna de Facebook. Esta es la versión de accesibilidad/bajo ancho de banda que Facebook mantiene para dispositivos básicos.

**Ventajas de mbasic:**

- **HTML estático**: No usa React, JavaScript dinámico ni shadow DOM.
- **Selectores estables**: Los atributos `name` de los formularios llevan años sin cambiar.
- **Independiente del idioma**: Los selectores usan `name` (no texto visible), así que funcionan igual en español, inglés o cualquier idioma.
- **Rápido**: Páginas livianas, sin JavaScript pesado.

### Selectores utilizados

Estos son los selectores HTML que la herramienta usa para interactuar con Facebook:

| Paso | Selector | Función |
|------|----------|---------|
| Escribir texto | `textarea[name="xc_message"]` | Campo de texto del post |
| Abrir upload de foto | `input[name="view_photo"]` | Botón para adjuntar foto |
| Seleccionar archivo | `input[name="file1"]` | Input de archivo para subir imagen |
| Confirmar foto | `input[name="add_photo_done"]` | Confirmar foto adjunta |
| Publicar | `input[name="view_post"]` | Botón de enviar publicación |

### Flujo de publicación

1. El navegador (Chromium) se abre con la sesión guardada.
2. Navega a `https://mbasic.facebook.com/groups/{groupId}`.
3. Encuentra el `textarea` y escribe el contenido del anuncio.
4. Si hay imagen, hace clic en "Photo", sube el archivo y confirma.
5. Hace clic en el botón de publicar.
6. Espera a que la página cargue confirmando el envío.
7. Cierra el navegador.

### Limitaciones

- **1 imagen por publicación**: mbasic solo permite subir una imagen a la vez.
- **Sesión**: La sesión puede expirar después de varias semanas. Si las publicaciones empiezan a fallar, ejecutar `npm run cli -- login` de nuevo.
- **2FA**: Si tu cuenta tiene autenticación de dos factores, debes hacer el login manual.

---

## 10. Historial de publicaciones

### Desde el Dashboard

La sección **Publicaciones** muestra el historial completo con:

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
| `PLAYWRIGHT_USER_DATA_DIR` | string | `./data/browser-session` | Ruta de sesión del navegador |
| `RETRY_ATTEMPTS` | number | `2` | Intentos de reintento |
| `RETRY_DELAY_MS` | number | `5000` | Milisegundos entre reintentos |

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
│   │   ├── publishers/     # Publisher con Playwright + mbasic
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
