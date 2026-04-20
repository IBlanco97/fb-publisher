import path from 'path';
import type { AppConfig } from './types';

export function getConfig(): AppConfig {
  return {
    playwright: {
      email: process.env.FB_EMAIL || '',
      password: process.env.FB_PASSWORD || '',
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      userDataDir: process.env.PLAYWRIGHT_USER_DATA_DIR || path.join(process.cwd(), 'data', 'browser-session'),
    },
    publishing: {
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '2', 10),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
    },
  };
}
