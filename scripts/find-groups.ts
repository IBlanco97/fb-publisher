/**
 * Busca grupos de Facebook usando Playwright con la sesión existente,
 * extrae las URLs/IDs reales y actualiza la base de datos.
 *
 * Uso: npx tsx scripts/find-groups.ts
 */

import path from 'path'
import { chromium } from 'playwright'
import { groupsRepo } from '../src/lib/db/repositories'

const SEARCH_USER_DATA_DIR = path.join(process.cwd(), 'data', 'search-session')

const SEARCH_TERMS = [
  'Cubanos en España',
  'Cubanos en USA',
  'Cubanos en Miami',
  'Remesas a Cuba',
  'Cuba Digital',
  'Familia Cubana en Diaspora',
  'Financieros Cubanos',
  'Cubanos en Mexico',
  'Emprendedores Cubanos Diaspora',
  'Negocios Online Cubanos',
]

async function findGroup(page: any, searchTerm: string): Promise<{ name: string; url: string; id: string } | null> {
  try {
    console.log(`\n🔍 Buscando: "${searchTerm}"...`)

    // Buscar grupos en mbasic
    const searchUrl = `https://mbasic.facebook.com/search/groups/?q=${encodeURIComponent(searchTerm)}`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(3000)

    // Debug del primer término
    if (searchTerm === SEARCH_TERMS[0]) {
      await page.screenshot({ path: `data/debug-search.png`, fullPage: true })
      const html = await page.content()
      const preview = html.substring(0, 2000)
      require('fs').writeFileSync('data/debug-search.html', html)
      console.log(`  🔍 Debug HTML (primeros 500 chars):\n  ${preview.substring(0, 500).replace(/\n/g, ' ')}\n`)
    }

    // Extraer todos los hrefs con /groups/
    const groupLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'))
      return links
        .map((a: any) => a.href)
        .filter((href: string) =>
          href.includes('facebook.com/groups/') &&
          !href.includes('/groups/search') &&
          !href.includes('/groups/discover') &&
          !href.includes('/groups/feed') &&
          !href.includes('?') &&
          /\/groups\/[\w.]+\/?$/.test(href)
        )
    })

    if (groupLinks.length === 0) {
      // Intento alternativo: buscar con formato diferente
      const allLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a')).map((a: any) => a.href)
      )
      const groupsWithQuery = allLinks.filter((h: string) => h.includes('/groups/') && !h.includes('/search'))
      if (groupsWithQuery.length > 0) {
        const first = groupsWithQuery[0]
        const urlMatch = first.match(/\/groups\/([^/?&#]+)/)
        if (urlMatch) {
          const groupId = urlMatch[1]
          const cleanUrl = `https://www.facebook.com/groups/${groupId}`
          console.log(`  ✅ Encontrado: ${cleanUrl}`)
          return { name: searchTerm, url: cleanUrl, id: groupId }
        }
      }
      console.log(`  ⚠️  Sin resultados para "${searchTerm}"`)
      return null
    }

    const first = groupLinks[0]
    const urlMatch = first.match(/\/groups\/([^/?&#]+)/)
    const groupId = urlMatch ? urlMatch[1] : null

    if (!groupId) {
      console.log(`  ⚠️  No se pudo extraer el ID`)
      return null
    }

    const cleanUrl = `https://www.facebook.com/groups/${groupId}`
    console.log(`  ✅ Encontrado: ${cleanUrl}`)
    return { name: searchTerm, url: cleanUrl, id: groupId }

  } catch (err: any) {
    console.log(`  ❌ Error: ${err.message}`)
    return null
  }
}

async function main() {
  console.log('🚀 Buscando grupos de Facebook con Playwright...\n')

  const context = await chromium.launchPersistentContext(SEARCH_USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })

  const page = context.pages()[0] || await context.newPage()

  // Verificar login
  await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(3000)

  const isLoggedIn = await page.evaluate(() => {
    return !document.querySelector('[data-testid="royal_login_button"]') &&
           !document.querySelector('button[name="login"]') &&
           !document.querySelector('#email')
  })

  if (!isLoggedIn) {
    console.log('⚠️  Necesitas loguearte en el navegador que se abrió.')
    console.log('    Tienes 3 minutos. Cuando termines el login, el script continúa automáticamente...')
    // Esperar hasta que el login se complete (desaparece el formulario)
    try {
      await page.waitForFunction(() => {
        return !document.querySelector('#email') && !document.querySelector('[data-testid="royal_login_button"]')
      }, { timeout: 180000 })
    } catch {
      console.log('⏱  Timeout de login. Continuando de todas formas...')
    }
  }

  // Debug: screenshot de la página actual
  await page.screenshot({ path: 'data/debug-home.png', fullPage: false })
  const pageTitle = await page.title()
  console.log(`✅ Página actual: "${pageTitle}"`)
  console.log('   Screenshot guardado en data/debug-home.png\n')

  const results: Array<{ name: string; url: string; id: string }> = []

  for (const term of SEARCH_TERMS) {
    const result = await findGroup(page, term)
    if (result) results.push(result)
    await page.waitForTimeout(2000) // pausa entre búsquedas
  }

  await context.close()

  // Actualizar base de datos
  console.log('\n📝 Actualizando base de datos...\n')

  const allGroups = groupsRepo.getAll()

  // Emparejar por índice — results[i] corresponde a SEARCH_TERMS[i] y allGroups[i]
  const groupsSorted = allGroups.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (let i = 0; i < results.length; i++) {
    const found = results[i]
    const match = groupsSorted[i]
    if (match) {
      groupsRepo.update(match.id, { url: found.url, fbGroupId: found.id, isActive: true })
      console.log(`  ✅ ${match.name} → ${found.url}`)
    }
  }

  console.log(`\n✅ ${results.length}/${SEARCH_TERMS.length} grupos encontrados y actualizados.`)
  console.log('📊 Revisa el dashboard en http://localhost:3002/dashboard/groups')
}

main().catch(console.error)
