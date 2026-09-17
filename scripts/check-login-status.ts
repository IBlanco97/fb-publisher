// One-off, read-only check: confirms whether the persisted Playwright
// session actually holds an authenticated Facebook cookie (c_user), without
// navigating to any page. Launches headless, reads cookies, closes.
import { chromium } from 'playwright';
import { getAccountUserDataDir } from '../src/lib/config';

async function main() {
  const accountId = process.argv[2] || 'default';
  const userDataDir = getAccountUserDataDir(accountId);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
  });
  try {
    const cookies = await context.cookies('https://www.facebook.com');
    const cUser = cookies.find((c) => c.name === 'c_user');
    if (cUser) {
      console.log(`LOGGED_IN uid=${cUser.value}`);
    } else {
      console.log('NOT_LOGGED_IN (no c_user cookie found)');
    }
  } finally {
    await context.close();
  }
}

main();
