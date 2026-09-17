import path from 'path';
import type { AppConfig } from './types';
import { settingsRepo } from './db/repositories';

export const DEFAULT_ACCOUNT_ID = 'default';

/**
 * `behavior` (the anti-detection pacing knobs) is read from the database,
 * not process.env — it's editable from the dashboard's Configuración page.
 * The env vars of the same name only seed the initial row on first run
 * (see migrateBehaviorSettings in db/database.ts).
 */
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
    behavior: settingsRepo.get(),
  };
}

/**
 * Resolves the Playwright persistent session directory for an account.
 *
 * Every account, including `default`, always uses the same deterministic
 * per-account path. An earlier version special-cased `default` to honor
 * PLAYWRIGHT_USER_DATA_DIR instead — but since the Next.js dev/prod server
 * loads .env.local automatically and the CLI (`npm run cli`, plain tsx) does
 * not, that special case made the dashboard and the CLI silently resolve to
 * two different Chrome profiles for the same account, each with its own
 * (possibly stale) login. One path avoids that split-brain state.
 */
export function getAccountUserDataDir(accountId: string): string {
  return path.join(process.cwd(), 'data', 'browser-sessions', accountId);
}
