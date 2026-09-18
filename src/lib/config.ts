import path from 'path';
import type { AppConfig } from './types';

export const DEFAULT_ACCOUNT_ID = 'default';

export function getConfig(): AppConfig {
  return {
    playwright: {
      email: process.env.FB_EMAIL || '',
      password: process.env.FB_PASSWORD || '',
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      userDataDir: getAccountUserDataDir(DEFAULT_ACCOUNT_ID),
    },
    publishing: {
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '2', 10),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
    },
    behavior: {
      jitterMinMinutes: parseInt(process.env.SCHEDULER_JITTER_MIN_MINUTES || '0', 10),
      jitterMaxMinutes: parseInt(process.env.SCHEDULER_JITTER_MAX_MINUTES || '20', 10),
      globalMinGapMinutes: parseInt(process.env.SCHEDULER_GLOBAL_MIN_GAP_MINUTES || '8', 10),
      maxPostsPerDayTotal: parseInt(process.env.SCHEDULER_MAX_POSTS_PER_DAY_TOTAL || '12', 10),
      crossAccountMinGapMinutes: parseInt(process.env.SCHEDULER_CROSS_ACCOUNT_MIN_GAP_MINUTES || '3', 10),
    },
  };
}

/**
 * Root folder for everything the app writes at runtime (database, browser
 * sessions). Packaged builds set FB_PUBLISHER_DATA_DIR because the server runs
 * from inside the bundled `app/` folder, which must stay read-only.
 */
export function getDataDir(): string {
  return process.env.FB_PUBLISHER_DATA_DIR || path.join(process.cwd(), 'data');
}

/**
 * Resolves the Playwright persistent session directory for an account.
 * The `default` account keeps honoring PLAYWRIGHT_USER_DATA_DIR so existing
 * installs don't lose an already-completed login when this feature ships.
 */
export function getAccountUserDataDir(accountId: string): string {
  if (accountId === DEFAULT_ACCOUNT_ID && process.env.PLAYWRIGHT_USER_DATA_DIR) {
    return process.env.PLAYWRIGHT_USER_DATA_DIR;
  }
  return path.join(getDataDir(), 'browser-sessions', accountId);
}
