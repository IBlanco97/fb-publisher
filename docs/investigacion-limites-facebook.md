# Límites de publicación orgánica en Facebook (grupos)

Investigación 2026-08-17. Fuentes al final.

## 1. Lo primero: no hay límite oficial

Meta **no publica** cifras. Documentación oficial solo dice que las restricciones
dependen de "velocidad y cantidad". Cualquier número concreto que circule es
medición de comunidad, no dato oficial — y Meta lo ajusta sin avisar.

Consecuencia práctica: no se puede diseñar contra un número. Hay que diseñar
contra un *patrón de comportamiento*.

## 2. Cifras que reporta la comunidad (2026)

| Antigüedad cuenta | Grupos/día "zona segura" |
|---|---|
| Cuenta nueva (<3 meses) | 10–15 |
| Establecida (3–6 meses) | 25–50 |
| Veterana (12+ meses) | hasta 100 |

Intervalo recomendado entre posts: **10+ minutos**, nunca fijo.

### ¿Se puede publicar en 20 grupos?
Sí — pero depende de la cuenta. Con cuenta nueva, 20 grupos/día ya está sobre el
umbral. Con cuenta de 6+ meses, 20 es cómodo *si* el espaciado y el contenido
varían.

### ¿Cuántos días seguidos?
No hay tope de días. Lo que penaliza no es la continuidad sino el **salto de
volumen**: subir más de ~30% sobre tu media reciente en un día es señal roja.
Publicar 15/día durante 60 días seguidos es más seguro que 5/día y de pronto 50.

## 3. Qué dispara el bloqueo (por orden de peso)

1. **Texto idéntico o mismo enlace en muchos destinos.** Es el disparador #1.
   Doce posts distintos pasan; el mismo post doce veces, no.
2. **Ritmo mecánico.** Delays constantes (siempre 60s) leen como script.
   Humano real: 30s, 47s, 38s, 51s, 33s…
3. **Desviación de la línea base.** El sistema conoce tu media histórica.
4. **Texto que aparece instantáneo** (paste) en lugar de tecleado.

## 4. Penalizaciones (escalan)

- 1er bloqueo: 24 h
- 2º: 3 días
- 3º: 1 semana
- Casos peores reportados: hasta 30 días

Si cae un bloqueo: **parar todo 24–48 h** — cero posts, cero comentarios, cero
nuevos ingresos a grupos. Seguir intentando alarga la sanción.

## 5. Extracción de datos de miembros del grupo

Punto de la nota: *"si puedo entrar a un grupo, ¿puedo extraer info de todas las
personas?"*

Técnicamente el listado de miembros es visible al ser miembro. Pero:
- Scrapear miembros viola los Términos de Meta de forma explícita y es una de las
  señales que más rápido produce baneo permanente de cuenta (no bloqueo temporal).
- Es dato personal → cae bajo GDPR/LOPD. Recolectarlo sin base legal es
  sancionable con independencia de lo que haga Facebook.

**Recomendación: no lo hagamos.** El riesgo (perder la cuenta que sostiene todo
el sistema + exposición legal) es desproporcionado frente al beneficio. Si el
cliente quiere datos de audiencia, la vía limpia es que la gente llegue a un
formulario propio desde el post.

Esto hay que confirmarlo con Rosmary/Jordi antes de descartarlo del alcance.

## 6. ¿m.facebook cambia? ¿con qué frecuencia?

`m.facebook.com` es la versión móvil ligera, mucho más estable en HTML que
`www` (que es React y cambia clases cada deploy). Aun así:
- Cambios menores de markup: varias veces al año, sin aviso.
- No hay changelog público. Se detecta cuando el selector falla.

Mitigación en el código: selectores por texto/rol antes que por clase CSS, y
alerta clara en el dashboard cuando un publish falla por selector no encontrado
(distinguirlo de "falló por bloqueo").

## 7. Contraste con lo que hace hoy nuestro publicador

Defaults actuales (`src/lib/config.ts`):

| Parámetro | Valor hoy | Lectura |
|---|---|---|
| `maxPostsPerDayTotal` | 12 | OK para cuenta nueva, conservador para veterana |
| `globalMinGapMinutes` | 8 | Algo corto (recomendado 10+) **y fijo** |
| `jitterMin/Max` | 0–20 min | Bien: rompe la hora exacta |
| `crossAccountMinGapMinutes` | 3 | OK |
| Cooldown por grupo | 60 min | OK |

### Ajustes propuestos
1. **Gap global aleatorio, no fijo.** Hoy `globalMinGapMinutes` es un umbral duro
   de 8 min; el post sale en cuanto pasa. Eso produce ritmo regular. Debería ser
   un rango (ej. 9–17 min) sorteado por publicación.
2. **Subir gap mínimo de 8 → 10 min.**
3. **Rampa de calentamiento.** Cuenta nueva no debería arrancar en 12/día.
   Empezar en 4–5 y subir ~25% semanal hasta el objetivo.
4. **Verificar varianza real de plantillas.** El riesgo #1 es texto repetido.
   Hay que medir cuántas variantes distintas produce el rotador antes de repetir.
5. **Tecleo simulado** en Playwright en vez de `fill()` directo, si no está ya.

Ninguno de estos está implementado todavía — son propuesta, pendientes de
priorizar.

## Fuentes

- [Latest Facebook Limits and Account Blocks: Avoiding Bans in 2026 — Elfsight](https://elfsight.com/blog/facebook-limits-and-blocks-avoiding-account-bans/)
- [Facebook Group Posting Limits 2026 — FB Group Bulk Poster](https://fbgroupbulkposter.com/blog/facebook-group-posting-limits-2026)
- [Facebook Group Posting Limits in 2026: How Many Is Too Many? — PilotPoster](https://www.pilotposter.com/blog/facebook-group-posting-limits/)
- [Bulk Posting on Facebook Without Getting Restricted — MultipleGroupPoster](https://multiplegroupposter.com/blog/bulk-posting-without-getting-restricted/)
- [How to Post in 20 Facebook Groups Daily Without Getting Banned — MarketWiz](https://marketwiz.ai/how-to-post-in-20-facebook-groups-daily-without-getting-banned/)
- [Facebook Group Posting Rules — Grovo](https://www.grovo.io/blog/facebook-group-posting-rules-avoid-getting-banned)

> Aviso: salvo Meta, todas son fuentes de terceros que venden herramientas de
> publicación masiva. Sus cifras están sesgadas al alza. Tratar como techo
> optimista, no como objetivo.
