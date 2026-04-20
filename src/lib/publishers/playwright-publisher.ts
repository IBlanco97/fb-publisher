import path from 'path';
import type { Publisher, PublishResult } from '../types';

/**
 * Playwright-based Facebook publisher using mbasic.facebook.com.
 *
 * Uses the mobile basic version of Facebook which renders static HTML
 * instead of the dynamic React-based modern UI. This makes selectors
 * simple and extremely stable across Facebook updates.
 *
 * Inspired by github.com/adar2/Facebook-Posts-Automation
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

      // Publish using mbasic.facebook.com (static HTML, stable selectors)
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
    await page.goto('https://mbasic.facebook.com', {
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

    // Check if login succeeded — mbasic redirects to feed on success
    const stillHasLogin = await page.$('input[name="email"]');
    return !stillHasLogin;
  }

  /**
   * DETERMINISTIC FUNCTION: Create a post in a Facebook group via mbasic.
   *
   * mbasic.facebook.com uses simple HTML forms with stable name attributes:
   *   - textarea[name="xc_message"] → post text
   *   - input[name="view_photo"]   → open photo upload
   *   - input[name="file1"]        → file input
   *   - input[name="add_photo_done"] → confirm photo
   *   - input[name="view_post"]    → submit post
   *
   * These selectors have been stable for years because mbasic is
   * Facebook's accessibility/low-bandwidth interface.
   */
  private async createPost(
    page: any,
    groupId: string,
    content: string,
    images?: string[]
  ): Promise<string | undefined> {
    // Step 1: Navigate to the group on mbasic
    const groupUrl = `https://mbasic.facebook.com/groups/${groupId}`;
    await page.goto(groupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Verify we're on a group page (not an error page)
    const pageTitle = await page.title();
    if (pageTitle.includes('Error') || pageTitle.includes('Page Not Found')) {
      throw new Error(`GROUP_NOT_FOUND: Could not load group ${groupId}`);
    }

    // Step 2: Fill the post text
    const textbox = await page.$('textarea[name="xc_message"]');
    if (!textbox) {
      throw new Error('COMPOSER_NOT_FOUND: Could not find textarea[name="xc_message"] on mbasic group page');
    }
    await textbox.fill(content);

    // Step 3: Upload image if provided
    if (images && images.length > 0) {
      await this.attachImage(page, images[0]);
    }

    // Step 4: Submit the post
    const postBtn = await page.$('input[name="view_post"]');
    if (!postBtn) {
      throw new Error('POST_BUTTON_NOT_FOUND: Could not find input[name="view_post"]');
    }
    await postBtn.click();

    // Step 5: Wait for post to be submitted
    await page.waitForLoadState('domcontentloaded');

    // Step 6: Upload additional images (mbasic only allows 1 per upload)
    // If there are more images, we'd need to edit the post or create comments
    // For now, first image only

    console.log(`[Playwright] Posted to group ${groupId} via mbasic.facebook.com`);
    return undefined;
  }

  /**
   * DETERMINISTIC FUNCTION: Attach a single image to a post via mbasic.
   *
   * mbasic flow: click "Photo" → file input appears → select file → confirm
   */
  private async attachImage(page: any, imagePath: string): Promise<void> {
    // Click the "Add Photo" / "Photo" button
    const photoBtn = await page.$('input[name="view_photo"]');
    if (!photoBtn) {
      console.log('[Playwright] Photo upload button not found, posting text only');
      return;
    }
    await photoBtn.click();
    await page.waitForLoadState('domcontentloaded');

    // Upload the file
    const fileInput = await page.$('input[name="file1"]');
    if (!fileInput) {
      throw new Error('FILE_INPUT_NOT_FOUND: Could not find input[name="file1"]');
    }

    // Resolve to absolute path
    const absolutePath = path.resolve(imagePath);
    await fileInput.setInputFiles(absolutePath);

    // Confirm the photo
    const doneBtn = await page.$('input[name="add_photo_done"]');
    if (doneBtn) {
      await doneBtn.click();
      await page.waitForLoadState('domcontentloaded');
    }
  }
}
