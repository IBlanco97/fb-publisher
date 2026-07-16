import path from 'path';
import type { Publisher, PublishResult } from '../types';

function randomBetween(minMs: number, maxMs: number): number {
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

/**
 * Playwright-based Facebook publisher using m.facebook.com ("weblite").
 *
 * mbasic.facebook.com (Facebook's old static-HTML mobile interface) was
 * retired by Meta — it now redirects to m.facebook.com. The weblite UI is
 * server-rendered but dispatches clicks via obfuscated `data-action-id`
 * attributes instead of plain forms, and the post composer is a Lexical
 * rich-text editor (`[role="textbox"][contenteditable="true"]`), not a
 * `<textarea>`. Selectors here are therefore less stable than the old
 * mbasic ones and may need updating if Meta changes weblite markup.
 *
 * Each deterministic function is isolated to facilitate future
 * self-healing via Claude Code (Phase 2).
 */
export class PlaywrightPublisher implements Publisher {
  name = 'playwright' as const;
  private userDataDir: string;
  private headless: boolean;

  constructor(opts: { userDataDir: string; headless?: boolean }) {
    this.userDataDir = opts.userDataDir;
    this.headless = opts.headless ?? true;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await import('playwright');
      return true;
    } catch {
      return false;
    }
  }

  async publish(groupId: string, content: string, images?: string[]): Promise<PublishResult> {
    const timestamp = new Date().toISOString();

    let context;
    try {
      const { chromium } = await import('playwright');

      context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: this.headless,
        viewport: { width: 480, height: 800 },
        userAgent:
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      });

      const page = context.pages()[0] || (await context.newPage());

      // Check if logged in, login if needed
      const loggedIn = await this.ensureLoggedIn(page);
      if (!loggedIn) {
        throw new Error('LOGIN_REQUIRED: Could not log in to Facebook. Run with PLAYWRIGHT_HEADLESS=false to log in manually.');
      }

      // Publish using m.facebook.com weblite composer
      const postResult = await this.createPost(page, groupId, content, images);

      return {
        success: true,
        postId: postResult,
        method: 'playwright',
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        method: 'playwright',
        error: error.message || 'Playwright automation failed',
        timestamp,
      };
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  /**
   * DETERMINISTIC FUNCTION: Check if user is logged in to Facebook.
   * If not, attempts login using env credentials.
   * For first-time setup, run with PLAYWRIGHT_HEADLESS=false.
   */
  private async ensureLoggedIn(page: any): Promise<boolean> {
    await page.goto('https://m.facebook.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // If we see a login form, we're not logged in
    const loginForm = await page.$('input[name="email"]');

    if (!loginForm) {
      // Already logged in (session persisted)
      return true;
    }

    // Try auto-login with env credentials
    const email = process.env.FB_EMAIL;
    const password = process.env.FB_PASSWORD;

    if (!email || !password) {
      return false;
    }

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="pass"]', password);
    await page.click('input[name="login"]');
    await page.waitForLoadState('domcontentloaded');

    // Check if login succeeded — m.facebook.com redirects to feed on success
    const stillHasLogin = await page.$('input[name="email"]');
    return !stillHasLogin;
  }

  /**
   * DETERMINISTIC FUNCTION: Create a post in a Facebook group via m.facebook.com.
   *
   * Flow (weblite composer, no plain forms):
   *   1. Open the group page and click the "Write something..." trigger,
   *      which navigates to m.facebook.com/composer/
   *   2. Click the Lexical textbox ([role="textbox"][contenteditable="true"])
   *      and type the content via real keyboard events (no .fill() — Lexical
   *      doesn't reflect direct value assignment)
   *   3. If an image is provided, click "Photos" and set the hidden
   *      input[type="file"]
   *   4. Click the sticky bottom POST button ([role="button"] with text
   *      "POST" — there are two matches on the page; the composer's own
   *      submit button is the last one in DOM order)
   */
  private async createPost(
    page: any,
    groupId: string,
    content: string,
    images?: string[]
  ): Promise<string | undefined> {
    // Step 1: Navigate to the group on m.facebook.com
    const groupUrl = `https://m.facebook.com/groups/${groupId}`;
    await page.goto(groupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    // Human-like dwell time — a bot that posts the instant the page loads
    // is an easy behavioral signal; a real person skims the feed first
    await page.waitForTimeout(randomBetween(2500, 6000));

    const pageTitle = await page.title();
    if (pageTitle.includes('Error') || pageTitle.includes('Page Not Found')) {
      throw new Error(`GROUP_NOT_FOUND: Could not load group ${groupId}`);
    }

    // Step 2: Click the composer trigger to open the post composer
    const composerOpened = await page.evaluate(() => {
      const triggerText = /write something|escrib[ei] algo/i;
      const spans = Array.from(document.querySelectorAll('span'));
      const target = spans.find((s) => triggerText.test(s.textContent || ''));
      if (!target) return false;
      let el: HTMLElement | null = target as HTMLElement;
      while (el && !el.hasAttribute('data-action-id')) el = el.parentElement;
      if (el) {
        el.click();
        return true;
      }
      return false;
    });

    if (!composerOpened) {
      throw new Error(
        'COMPOSER_TRIGGER_NOT_FOUND: Could not find the "Write something..." composer trigger. ' +
        'The account may not be a member of this group, or Facebook changed the weblite markup.'
      );
    }

    await page.waitForURL('**/composer/**', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(randomBetween(1500, 3000));

    // Step 3: Click the Lexical text editor and type the content at a
    // human-plausible, variable typing speed (a bot typing every post at a
    // perfectly constant rate is itself a detectable fingerprint)
    const textbox = page.locator('[role="textbox"][contenteditable="true"]').first();
    const textboxCount = await page.locator('[role="textbox"][contenteditable="true"]').count();
    if (textboxCount === 0) {
      throw new Error('COMPOSER_TEXTBOX_NOT_FOUND: Could not find the Lexical [role="textbox"] editor on the composer page');
    }
    await textbox.click();
    await this.typeLikeHuman(page, content);
    await page.waitForTimeout(randomBetween(800, 2000));

    // Step 4: Upload image if provided
    if (images && images.length > 0) {
      await this.attachImage(page, images[0]);
    }

    // Step 5: Submit the post — the composer's submit button is the last
    // "POST" role=button on the page (the first is a header link)
    const postButtons = page.locator('[role="button"]', { hasText: 'POST' });
    const postButtonCount = await postButtons.count();
    if (postButtonCount === 0) {
      throw new Error('POST_BUTTON_NOT_FOUND: Could not find a [role="button"] with text "POST"');
    }
    await postButtons.last().click();

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    console.log(`[Playwright] Posted to group ${groupId} via m.facebook.com`);
    return undefined;
  }

  /**
   * Types text with per-character delay varying between keystrokes, instead
   * of a fixed rate, to avoid the constant-cadence fingerprint of scripted
   * input. Occasionally pauses briefly mid-sentence, like someone thinking.
   */
  private async typeLikeHuman(page: any, text: string): Promise<void> {
    const chunks = text.split(/(?<=[.,\n])/); // split keeping punctuation, natural pause points
    for (const chunk of chunks) {
      await page.keyboard.type(chunk, { delay: randomBetween(35, 110) });
      if (Math.random() < 0.25) {
        await page.waitForTimeout(randomBetween(200, 700));
      }
    }
  }

  /**
   * DETERMINISTIC FUNCTION: Attach a single image to a post via m.facebook.com.
   *
   * Flow: click "Photos" label → hidden input[type="file"] appears → set file
   */
  private async attachImage(page: any, imagePath: string): Promise<void> {
    const photosClicked = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('span, div'));
      const target = candidates.find((el) => el.textContent?.trim() === 'Photos');
      if (!target) return false;
      let el: HTMLElement | null = target as HTMLElement;
      while (el && !el.hasAttribute('data-action-id') && el.getAttribute('role') !== 'button') {
        el = el.parentElement;
      }
      if (el) {
        el.click();
        return true;
      }
      return false;
    });

    if (!photosClicked) {
      console.log('[Playwright] "Photos" button not found, posting text only');
      return;
    }

    await page.waitForTimeout(1500);

    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) === 0) {
      throw new Error('FILE_INPUT_NOT_FOUND: Could not find input[type="file"] after clicking Photos');
    }

    const absolutePath = path.resolve(imagePath);
    await fileInput.setInputFiles(absolutePath);
    await page.waitForTimeout(2000);
  }
}
