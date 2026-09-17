import type { Publisher, PublishResult } from '../types';

/**
 * Stands in for the real Playwright publisher end-to-end: same interface,
 * same call site, but never launches a browser or touches Facebook. Used to
 * validate the rest of the pipeline (cron trigger, jitter, rate limiting,
 * rotation, template rendering, publication bookkeeping) without publishing
 * anything real.
 */
export class DryRunPublisher implements Publisher {
  name = 'dry-run';

  async publish(groupFbId: string, content: string, images?: string[]): Promise<PublishResult> {
    console.log(`\n[DRY RUN] Se habría publicado en el grupo "${groupFbId}":`);
    console.log('----------------------------------------');
    console.log(content);
    if (images && images.length > 0) console.log(`(${images.length} imagen(es) adjunta(s))`);
    console.log('----------------------------------------\n');

    return {
      success: true,
      method: 'dry_run',
      timestamp: new Date().toISOString(),
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
