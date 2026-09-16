# Telegram: forma más eficiente de hacerlo

Investigación 2026-08-17.

## Conclusión corta

Telegram es **mucho más fácil y más barato** que Facebook — pero solo si nos
dejan entrar por la puerta oficial. Hay una condición dura que decide todo:

> Un bot **no puede** enviar mensajes a un grupo al que no ha sido añadido.
> No hay forma de saltarse esto. Es diseño anti-spam de Telegram.

Es decir: en cada grupo destino, un admin tiene que añadir nuestro bot.
Si el cliente controla los grupos → trivial. Si son grupos de terceros →
hay que negociar con cada admin, y ahí Telegram deja de ser "fácil".

## Vía A — Bot API oficial (recomendada)

Cómo: crear bot con @BotFather, admin del grupo lo añade, se publica con
`sendMessage`.

Ventajas:
- API documentada y estable. Nada de scraping, nada de selectores que rompen.
- Cero riesgo de baneo de cuenta personal.
- Sin navegador: no hace falta Playwright. Un `fetch` basta.
- Enormemente más barato en recursos que el publicador de Facebook.

Límites (oficiales, públicos — al revés que Meta):
- 1 mensaje/segundo por chat.
- **20 mensajes/minuto en un grupo.**
- ~30 mensajes/segundo en broadcast global del bot.
- Opción de *paid broadcast* (@BotFather) sube a 1000 msg/s, a 0.1 Telegram
  Stars por mensaje. Irrelevante para nuestro volumen.

Nuestro caso (decenas de posts/día, no miles) queda **muy** por debajo de todos
estos topes. No necesitamos cola distribuida ni token bucket; basta con espaciar
y reintentar en 429.

Manejo de errores: la API devuelve 429 con `retry_after` en segundos. Respetarlo
literalmente y reintentar.

## Vía B — Userbot (Telethon / cuenta de usuario real)

Se usa la cuenta personal vía API de cliente, así puede publicar en cualquier
grupo donde la persona ya sea miembro — sin permiso de admin.

**No recomendada.** Hay reportes de baneo del número de teléfono en menos de
24 h de uso. Y un número baneado en Telegram es difícil de recuperar. Reproduce
exactamente el problema que tenemos con Facebook, sin la ventaja de que aquí sí
existe una alternativa legítima.

Solo consideraría esto si el cliente confirma que los grupos son de terceros y
que aun así quiere seguir — decisión suya, con el riesgo por escrito.

## Arquitectura si entra Telegram en el proyecto

La buena noticia: el proyecto ya está partido de forma que esto encaja.
`src/lib/publishers/` tiene un `PublisherManager` con Playwright como
implementación. Telegram sería **otro publisher** detrás de la misma interfaz:

- Scheduler, plantillas, rotación, historial de publicaciones y dashboard se
  reutilizan tal cual.
- El publisher de Telegram no necesita ni jitter agresivo ni proxies ni sesión
  de navegador — los frenos anti-detección de Facebook sobran aquí.
- Los `groups` necesitarían un campo de plataforma (`facebook` | `telegram`) y
  el `fb_group_id` pasaría a ser un `chat_id` genérico.

Estimación: es bastante menos trabajo que lo ya construido para Facebook.

## Lo que hay que preguntar al cliente

1. ¿Los grupos de Telegram son suyos / tienen admin conocido? (decide A vs B)
2. Lista de grupos con enlace.
3. ¿Mismo contenido que Facebook o plantillas propias?

## Fuentes

- [Telegram Bots FAQ (oficial)](https://core.telegram.org/bots/faq)
- [Telegram Limits — tginfo](https://limits.tginfo.me/en)
- [Telegram Bot API Rate Limits Explained (2026)](https://botnamefinder.com/blog/telegram-bot-rate-limits-explained)
- [Telegram Bulk Messaging: limits and risks — CRMChat](https://crmchat.ai/blog/telegram-bulk-messaging-limits-risks)
- [Send message to group: the permission problem — BotHero](https://blog.bothero.ai/telegram-bot-send-message-to-group-the-permission-nightmare-nobody-warns-you-about-and-the-3-architectures-that-actually-work)
- [Telethon issue #3955 — cuenta baneada](https://github.com/LonamiWebs/Telethon/issues/3955)
