'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findJava, findConfigDir, findLauncherJar } = require('./install');

const COPILOT_LSP_CONFIG = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.copilot',
  'lsp-config.json'
);

function checkJavaVersion(javaPath) {
  try {
    const output = execSync(`"${javaPath}" -version 2>&1`, {
      encoding: 'utf8',
      timeout: 10000,
    });

    const match = output.match(/version "(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      return { version: major, output: output.trim() };
    }
    return { version: null, output: output.trim() };
  } catch (e) {
    return { version: null, output: e.message };
  }
}

/**
 * Auto-register with Copilot CLI's lsp-config.json.
 * Merges a java server entry without overwriting existing config.
 */
function registerWithCopilotCli() {
  const javaEntry = {
    command: 'jdtls',
    args: ['--stdio'],
    fileExtensions: {
      '.java': 'java',
    },
  };

  let config = { lspServers: {} };

  // Read existing config if present
  if (fs.existsSync(COPILOT_LSP_CONFIG)) {
    try {
      config = JSON.parse(fs.readFileSync(COPILOT_LSP_CONFIG, 'utf8'));
      if (!config.lspServers) {
        config.lspServers = {};
      }
    } catch (e) {
      console.warn(`⚠ Warning: Could not parse ${COPILOT_LSP_CONFIG}: ${e.message}`);
      console.warn('  Skipping auto-registration. You can manually add the java entry.');
      return false;
    }
  }

  // Don't overwrite if java is already configured
  if (config.lspServers.java) {
    console.log('ℹ Java LSP already registered in Copilot CLI config.');
    return true;
  }

  // Add java entry
  config.lspServers.java = javaEntry;

  // Write back
  const configDir = path.dirname(COPILOT_LSP_CONFIG);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(COPILOT_LSP_CONFIG, JSON.stringify(config, null, 2) + '\n');
  console.log(`✓ Auto-registered Java LSP in ${COPILOT_LSP_CONFIG}`);
  return true;
}

function main() {
  console.log('@vscjava/java-language-server - Post-install verification\n');

  let hasErrors = false;

  // 1. Check Java
  const javaPath = findJava({});
  console.log(`Java executable: ${javaPath}`);

  const javaInfo = checkJavaVersion(javaPath);
  if (javaInfo.version) {
    console.log(`Java version: ${javaInfo.version}`);
    if (javaInfo.version < 21) {
      console.warn(`⚠ Warning: Java 21+ is required, but found Java ${javaInfo.version}.`);
      console.warn('  Install Java 21+ or use the bundled JRE package.');
      hasErrors = true;
    } else {
      console.log('✓ Java version OK');
    }
  } else {
    console.warn('⚠ Warning: Could not determine Java version.');
    console.warn(`  Output: ${javaInfo.output}`);
    console.warn('  jdtls requires Java 21+. Ensure it is installed and accessible.');
    hasErrors = true;
  }

  // 2. Check platform config
  const configDir = findConfigDir();
  if (configDir) {
    console.log(`✓ Platform config: ${configDir}`);
  } else {
    console.warn(`⚠ Warning: No platform config found for ${process.platform}.`);
    hasErrors = true;
  }

  // 3. Check launcher jar
  const serverDir = require('path').join(__dirname, '..', 'server');
  const launcher = findLauncherJar(serverDir);
  if (launcher) {
    console.log(`✓ Launcher jar: ${launcher}`);
  } else {
    console.log('ℹ Note: Launcher jar not found. Place jdtls server files in server/plugins/.');
    console.log('  Download from: https://download.eclipse.org/jdtls/milestones/');
  }

  // 4. Auto-register with Copilot CLI
  console.log('');
  registerWithCopilotCli();

  // Summary
  console.log('');
  if (hasErrors) {
    console.log('Setup completed with warnings. Some features may not work until issues are resolved.');
  } else {
    console.log('Setup completed successfully! Java LSP is ready for Copilot CLI.');
    console.log('No java-lsp.json needed for standard Maven/Gradle projects.');
  }
}

main();
