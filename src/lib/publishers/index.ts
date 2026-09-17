import type { Publisher, PublishResult, ProxyConfig } from '../types';
import { PlaywrightPublisher } from './playwright-publisher';
import { DryRunPublisher } from './dry-run-publisher';

/**
 * Publisher manager.
 * Uses Playwright with m.facebook.com for all publishing, unless `dryRun`
 * is set — then it never launches a browser or touches Facebook at all.
 * Bound to a single Facebook account's session + proxy for its lifetime.
 */
export class PublisherManager {
  private impl: Publisher;

  constructor(config: {
    playwrightUserDataDir: string;
    playwrightHeadless?: boolean;
    proxy?: ProxyConfig;
    dryRun?: boolean;
  }) {
    this.impl = config.dryRun
      ? new DryRunPublisher()
      : new PlaywrightPublisher({
          userDataDir: config.playwrightUserDataDir,
          headless: config.playwrightHeadless ?? true,
          proxy: config.proxy,
        });
  }

  async publish(
    groupFbId: string,
    content: string,
    images?: string[],
  ): Promise<PublishResult> {
    return this.impl.publish(groupFbId, content, images);
  }

  async isAvailable(): Promise<boolean> {
    return this.impl.isAvailable();
  }
}
