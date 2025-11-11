/**
 * VPA Admin - Master Menu
 *
 * Main entry point for all admin tools.
 * Usage: npm run admin
 */

import { promptNumber, header, divider } from './utils.js';

async function showMenu() {
  header('VPA Admin - Master Control Panel');

  console.log('Available Tools:\n');
  console.log('  [1] Create User          - Onboard new customers');
  console.log('  [2] Grant Modules        - Add/remove modules');
  console.log('  [3] View Usage           - Analytics dashboard');
  console.log('  [4] Manage Subscriptions - Plans, trials, billing');
  console.log('  [5] List Users           - View and export users');
  console.log('  [6] Health Check         - System diagnostics');
  console.log('  [7] Exit\n');

  divider();
  console.log();

  const choice = await promptNumber('Select tool (1-7): ', 1, 7);

  if (choice === 7) {
    console.log('\nGoodbye!\n');
    process.exit(0);
  }

  // Map choices to npm scripts
  const scripts = [
    'admin:create-user',
    'admin:grant-modules',
    'admin:view-usage',
    'admin:manage-subs',
    'admin:list-users',
    'admin:health'
  ];

  const script = scripts[choice - 1];

  console.log(`\nLaunching: npm run ${script}\n`);
  console.log('─'.repeat(60));
  console.log();

  // Import and run the selected tool
  switch (choice) {
    case 1:
      await import('./create-user.js');
      break;
    case 2:
      await import('./grant-modules.js');
      break;
    case 3:
      await import('./view-usage.js');
      break;
    case 4:
      await import('./manage-subscriptions.js');
      break;
    case 5:
      await import('./list-users.js');
      break;
    case 6:
      await import('./health-check.js');
      break;
  }
}

// Run the menu
showMenu().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
