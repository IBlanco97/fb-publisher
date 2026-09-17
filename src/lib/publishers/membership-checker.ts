import type { ProxyConfig } from '../types';

/**
 * Checks whether the logged-in Facebook account is a member of a group,
 * using the same persistent Playwright session as the publisher. Read-only
 * — never posts or joins anything.
 */
export async function checkGroupMembership(
  fbGroupId: string,
  opts: { userDataDir: string; headless?: boolean; proxy?: ProxyConfig }
): Promise<'member' | 'not_member' | 'pending' | 'error'> {
  try {
    const { chromium } = await import('playwright');

    const context = await chromium.launchPersistentContext(opts.userDataDir, {
      headless: opts.headless ?? true,
      viewport: { width: 480, height: 800 },
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      proxy: opts.proxy,
    });

    try {
      // A public group's preview page shows a "Join group" prompt to anonymous
      // visitors too, so that text alone can't tell "not a member" apart from
      // "not logged in". Check for Facebook's own auth cookie first.
      const cookies = await context.cookies('https://www.facebook.com');
      if (!cookies.some((c) => c.name === 'c_user')) return 'error';

      const page = context.pages()[0] || (await context.newPage());
      await page.goto(`https://m.facebook.com/groups/${fbGroupId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      // The logged-in group page renders client-side and is empty for the
      // first ~2-3s — a fixed short wait can read it mid-render (empty body
      // reads as "no Join button" => false "member"). Poll for real content
      // instead of trusting a fixed delay.
      try {
        await page.waitForFunction(() => document.body.innerText.trim().length > 200, {
          timeout: 8000,
        });
      } catch {
        return 'error'; // never rendered real content within the budget
      }

      // The SPA occasionally bounces back to the home feed a few seconds
      // after landing on the group page; reading membership off the wrong
      // page would be worse than reporting "couldn't tell".
      if (!page.url().includes(`/groups/${fbGroupId}`)) return 'error';

      const hasJoinButton = await page.evaluate(() =>
        Array.from(document.querySelectorAll('span, div')).some(
          (e) => e.textContent?.trim() === 'Join group'
        )
      );
      const hasPendingRequest = await page.evaluate(() =>
        /request pending|solicitud enviada|request sent/i.test(document.body.innerText)
      );

      if (hasPendingRequest) return 'pending';
      return hasJoinButton ? 'not_member' : 'member';
    } finally {
      await context.close().catch(() => {});
    }
  } catch {
    return 'error';
  }
}
