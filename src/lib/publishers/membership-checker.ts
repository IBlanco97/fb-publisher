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
      const page = context.pages()[0] || (await context.newPage());
      await page.goto(`https://m.facebook.com/groups/${fbGroupId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await page.waitForTimeout(2500);

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
