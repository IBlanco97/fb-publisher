import type { PublishResult } from '../types';
import { PlaywrightPublisher } from './playwright-publisher';

/**
 * Publisher manager.
 * Uses Playwright with mbasic.facebook.com for all publishing.
 */
export class PublisherManager {
  private playwright: PlaywrightPublisher;

  constructor(config: {
    playwrightUserDataDir: string;
    playwrightHeadless?: boolean;
  }) {
    this.playwright = new PlaywrightPublisher({
      userDataDir: config.playwrightUserDataDir,
      headless: config.playwrightHeadless ?? true,
    });
  }

  async publish(
    groupFbId: string,
    content: string,
    images?: string[],
  ): Promise<PublishResult> {
    return this.playwright.publish(groupFbId, content, images);
  }

  async isAvailable(): Promise<boolean> {
    return this.playwright.isAvailable();
  }
}
