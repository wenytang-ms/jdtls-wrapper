#!/usr/bin/env node

'use strict';

/**
 * Publishes all packages in the correct order.
 * Platform packages must be published before the main package
 * so that optionalDependencies resolve correctly.
 */

const { execSync } = require('child_process');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');

// Platform packages first, then main package last
const PUBLISH_ORDER = [
  'java-ls-config-win32',
  'java-ls-config-linux',
  'java-ls-config-darwin',
  'java-ls-jre-win32-x64',
  'java-ls-jre-linux-x64',
  'java-ls-jre-darwin-arm64',
  'java-language-server',   // Must be last
];

const args = process.argv.slice(2).join(' ');

for (const pkg of PUBLISH_ORDER) {
  const pkgDir = path.join(PACKAGES_DIR, pkg);
  console.log(`\nPublishing ${pkg}...`);
  try {
    execSync(`npm publish ${args}`, {
      cwd: pkgDir,
      stdio: 'inherit',
    });
    console.log(`✓ ${pkg} published successfully.`);
  } catch (e) {
    console.error(`✗ Failed to publish ${pkg}: ${e.message}`);
    process.exit(1);
  }
}

console.log('\n✓ All packages published successfully!');
