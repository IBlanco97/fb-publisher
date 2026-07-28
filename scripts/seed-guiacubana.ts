/**
 * Seed script: carga grupos y templates de GuiaCubana en fb-publisher.
 * Uso: npx tsx scripts/seed-guiacubana.ts
 */

import { groupsRepo, templatesRepo } from '../src/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID } from '../src/lib/config';

// ─── GRUPOS ───────────────────────────────────────────────────────────────────
// Reemplaza cada URL con la URL real del grupo de Facebook

const groups = [
  { name: 'Cubanos en España',               url: 'https://www.facebook.com/groups/REEMPLAZAR_1' },
  { name: 'Cubanos en USA',                  url: 'https://www.facebook.com/groups/REEMPLAZAR_2' },
  { name: 'Cubanos en Miami',                url: 'https://www.facebook.com/groups/REEMPLAZAR_3' },
  { name: 'Remesas a Cuba',                  url: 'https://www.facebook.com/groups/REEMPLAZAR_4' },
  { name: 'Cuba Digital',                    url: 'https://www.facebook.com/groups/REEMPLAZAR_5' },
  { name: 'Familia Cubana en Diáspora',      url: 'https://www.facebook.com/groups/REEMPLAZAR_6' },
  { name: 'Financieros Cubanos',             url: 'https://www.facebook.com/groups/REEMPLAZAR_7' },
  { name: 'Cubanos en México',               url: 'https://www.facebook.com/groups/REEMPLAZAR_8' },
  { name: 'Emprendedores Cubanos Diáspora',  url: 'https://www.facebook.com/groups/REEMPLAZAR_9' },
  { name: 'Negocios Online Cubanos',         url: 'https://www.facebook.com/groups/REEMPLAZAR_10' },
]

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
// 5 artículos × 3 formatos = 15 templates

const templates = [

  // ── Artículo 1: Cómo enviar dinero a Cuba ────────────────────────────────
  {
    name: '[Remesas] Enviar dinero — DATO',
    body: `Comparé 5 formas de enviar $100 a Cuba en 2026. La diferencia es brutal:

💸 Wise: te cobran $2.80
💸 Remitly: $3.99
💸 Western Union: $8.00
💸 MoneyGram: $9.50

Si envías $100 cada semana, la diferencia entre Wise y Western Union es más de $300 al año.

Hice una guía completa con tarifas actualizadas 👇
https://guiacubana.vercel.app/blog/como-enviar-dinero-cuba-2026`,
  },
  {
    name: '[Remesas] Enviar dinero — PREGUNTA',
    body: `¿Cuál es tu servicio favorito para enviar dinero a Cuba? 🤔

Wise, Remitly, Western Union, MoneyGram...

Acabo de comparar todos en 2026 y los resultados me sorprendieron. Hay una diferencia enorme en tarifas.

¿Quieres ver la comparativa completa?
👉 https://guiacubana.vercel.app/blog/como-enviar-dinero-cuba-2026`,
  },
  {
    name: '[Remesas] Enviar dinero — HISTORIA',
    body: `Mi familia en Cuba me decía: "Entra menos dinero cada vez."

Yo no entendía por qué... hasta que calculé lo que me cobraban en tarifas ocultas.

Western Union me robaba $8 de cada $100. MoneyGram casi $10.

Cambié a Wise y ahora pago $2.80. Al año, eso es más de $270 de diferencia.

Si mandas dinero regularmente, esto te cambia la vida:
https://guiacubana.vercel.app/blog/como-enviar-dinero-cuba-2026`,
  },

  // ── Artículo 2: Cuánto cuesta enviar $100 ────────────────────────────────
  {
    name: '[Remesas] Costo $100 — DATO',
    body: `¿Sabes cuánto llega REALMENTE de $100 que envías a Cuba?

✅ Wise → llegan $97.20
✅ Remitly → llegan $95.51
⚠️ Western Union → llegan $90.50
❌ MoneyGram → llegan $88.50

La diferencia no es solo la tarifa visible. El tipo de cambio también come dinero.

Desglose completo aquí:
https://guiacubana.vercel.app/blog/cuanto-cuesta-enviar-100-cuba`,
  },
  {
    name: '[Remesas] Costo $100 — PREGUNTA',
    body: `Pregunta rápida: ¿sabes exactamente cuánto cobra tu servicio de remesas por cada $100?

No solo la tarifa que aparece en pantalla... también el margen del tipo de cambio.

Hice los cálculos con números reales. Los resultados son muy diferentes a lo que la mayoría cree.

Ver comparativa:
👉 https://guiacubana.vercel.app/blog/cuanto-cuesta-enviar-100-cuba`,
  },
  {
    name: '[Remesas] Costo $100 — HISTORIA',
    body: `Creía que pagaba $4 por enviar dinero a Cuba. En realidad pagaba casi $12.

La diferencia estaba en el tipo de cambio. El servicio me daba un tipo peor que el real y se quedaba con la diferencia sin que yo lo viera.

Cuando aprendí a calcular el costo real, cambié de servicio inmediatamente.

Aquí explico cómo calcularlo:
https://guiacubana.vercel.app/blog/cuanto-cuesta-enviar-100-cuba`,
  },

  // ── Artículo 3: Apps para recibir remesas en Cuba ─────────────────────────
  {
    name: '[Apps] Recibir remesas Cuba — DATO',
    body: `Si tu familia está en Cuba, estas son las mejores formas de recibir dinero en 2026:

📱 Tropipay — tarjeta virtual Visa, recibe y usa internacionalmente
🏦 Cuenta MLC (BPA/Banco Metropolitano) — compatible con Wise
💵 WorldRemit en efectivo — sin necesidad de cuenta bancaria

La combinación más eficiente: envías por Wise → recibes en cuenta MLC.

Guía completa para la familia que recibe:
https://guiacubana.vercel.app/blog/mejores-apps-recibir-remesas-cuba`,
  },
  {
    name: '[Apps] Recibir remesas Cuba — PREGUNTA',
    body: `¿Tu familia en Cuba tiene Tropipay? ¿O cuenta en MLC?

La forma en que reciben el dinero importa tanto como el servicio que usas para enviarlo.

Si no tienen la app correcta, pueden estar perdiendo dinero en conversiones innecesarias.

Aquí está la guía de las mejores opciones para recibir en Cuba:
👉 https://guiacubana.vercel.app/blog/mejores-apps-recibir-remesas-cuba`,
  },
  {
    name: '[Apps] Recibir remesas Cuba — HISTORIA',
    body: `Le pedí a mi mamá en Cuba que abriera Tropipay. Tardó 20 minutos.

Desde entonces le llega el dinero en minutos, no en días. Y puede usarlo con tarjeta Visa en cualquier lugar.

Antes usábamos Western Union en efectivo y ella tenía que hacer cola en la cadeca.

Si tu familia todavía recibe en efectivo, esto les puede cambiar la experiencia:
https://guiacubana.vercel.app/blog/mejores-apps-recibir-remesas-cuba`,
  },

  // ── Artículo 4: Cómo funciona Wise ───────────────────────────────────────
  {
    name: '[Apps] Tutorial Wise — DATO',
    body: `Wise es el servicio con las tarifas más bajas para enviar dinero. Pero mucha gente no sabe cómo usarlo.

5 pasos para empezar:
1️⃣ Crea cuenta en wise.com (gratis)
2️⃣ Verifica tu identidad (pasaporte o ID)
3️⃣ Añade método de pago (débito o transferencia bancaria)
4️⃣ Elige monto y destino
5️⃣ Confirma — el dinero llega en 1-2 días

Tutorial completo paso a paso:
https://guiacubana.vercel.app/blog/como-funciona-wise-tutorial`,
  },
  {
    name: '[Apps] Tutorial Wise — PREGUNTA',
    body: `¿Ya usas Wise para tus transferencias?

Es el servicio más barato del mercado pero muchos lo evitan porque no saben cómo funciona.

Hice un tutorial completo en español, paso a paso, para que no tengas dudas:
👉 https://guiacubana.vercel.app/blog/como-funciona-wise-tutorial`,
  },

  // ── Artículo 5: Construir crédito en USA ─────────────────────────────────
  {
    name: '[Crédito] Construir crédito USA — DATO',
    body: `Llegaste a USA sin historial crediticio. Aquí está el camino más rápido para construirlo:

📌 Mes 1-2: Abre cuenta en Chime o Current (sin requisitos)
📌 Mes 2-3: Solicita una secured credit card (Self o Kikoff)
📌 Mes 3-6: Paga el 100% del balance cada mes
📌 Mes 6-12: Tu score llega a 650-700

Con 650 puedes acceder a tarjetas sin depósito y préstamos básicos.

Guía completa desde cero:
https://guiacubana.vercel.app/blog/construir-credito-cubanos-usa`,
  },
  {
    name: '[Crédito] Construir crédito USA — PREGUNTA',
    body: `¿Cuánto tiempo llevas en USA sin credit score?

El historial crediticio es lo más importante para alquilar apartamento, comprar carro, o pedir préstamo.

La buena noticia: se puede construir desde cero en menos de 12 meses.

Aquí está el plan paso a paso que funciona para cubanos recién llegados:
👉 https://guiacubana.vercel.app/blog/construir-credito-cubanos-usa`,
  },
  {
    name: '[Crédito] Construir crédito USA — HISTORIA',
    body: `Llegué a USA y el landlord me rechazó el apartamento. "No credit history."

No entendía nada. ¿Cómo iba a tener historial si acababa de llegar?

En 8 meses construí un score de 680 siguiendo un plan específico.

Aquí está exactamente lo que hice:
https://guiacubana.vercel.app/blog/construir-credito-cubanos-usa`,
  },
]

// ─── EJECUTAR ─────────────────────────────────────────────────────────────────

console.log('Cargando grupos...\n')
for (const g of groups) {
  const match = g.url.match(/groups\/(\d+)/)
  const fbGroupId = match ? match[1] : g.url
  const created = groupsRepo.create({
    accountId: DEFAULT_ACCOUNT_ID,
    name: g.name,
    fbGroupId,
    url: g.url,
    isActive: false, // inactivos hasta poner URL real
    maxPostsPerDay: 2,
    cooldownMinutes: 120,
  })
  console.log(`  ✓ ${created.name} (${created.id})`)
}

console.log('\nCargando templates...\n')
for (const t of templates) {
  const created = templatesRepo.create({
    accountId: DEFAULT_ACCOUNT_ID,
    name: t.name,
    body: t.body,
    variables: [],
    isActive: true,
  })
  console.log(`  ✓ ${created.name} (${created.id})`)
}

console.log('\n✅ Seed completado.')
console.log('⚠️  Actualiza las URLs de los grupos en el dashboard antes de activarlos.')
