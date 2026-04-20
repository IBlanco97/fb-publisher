import path from 'path'
import { chromium } from 'playwright'

const DIR = path.join(process.cwd(), 'data', 'search-session')

;(async () => {
  const ctx = await chromium.launchPersistentContext(DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  })
  const page = ctx.pages()[0] || await ctx.newPage()
  await page.goto('https://www.facebook.com')
  console.log('Logeate en el navegador. Ciérralo cuando termines...')
  await new Promise(r => ctx.on('close', r))
  console.log('Sesión guardada.')
})()
