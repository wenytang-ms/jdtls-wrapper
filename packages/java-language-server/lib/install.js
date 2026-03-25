'use strict';

const path = require('path');
const fs = require('fs');

const PLATFORM_CONFIG_MAP = {
  win32: 'config_win',
  linux: 'config_linux',
  darwin: 'config_mac',
};

const PLATFORM_PKG_MAP = {
  win32: '@msinternal/java-ls-config-win32',
  linux: '@msinternal/java-ls-config-linux',
  darwin: '@msinternal/java-ls-config-darwin',
};

/**
 * Find a Java executable. Priority:
 * 1. Bundled JRE (optional npm package)
 * 2. Config-specified java.home
 * 3. JAVA_HOME environment variable
 * 4. 'java' on PATH
 */
function findJava(config) {
  const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';

  // 1. Check bundled JRE package
  const jrePkg = `@msinternal/java-ls-jre-${process.platform}-${process.arch}`;
  try {
    const jrePkgDir = path.dirname(require.resolve(`${jrePkg}/package.json`));
    const bundledJava = path.join(jrePkgDir, 'jre', 'bin', javaExeName);
    if (fs.existsSync(bundledJava)) {
      return bundledJava;
    }
  } catch {
    // Package not installed, continue
  }

  // 2. Check config-specified java.home
  if (config && config.java && config.java.home) {
    const configJava = path.join(config.java.home, 'bin', javaExeName);
    if (fs.existsSync(configJava)) {
      return configJava;
    }
    console.error(`Warning: java.home in config points to ${config.java.home} but java not found there.`);
  }

  // 3. Check JAVA_HOME
  if (process.env.JAVA_HOME) {
    const javaHome = path.join(process.env.JAVA_HOME, 'bin', javaExeName);
    if (fs.existsSync(javaHome)) {
      return javaHome;
    }
    console.error(`Warning: JAVA_HOME is set to ${process.env.JAVA_HOME} but java not found there.`);
  }

  // 4. Fallback to PATH
  return javaExeName;
}

/**
 * Find the platform-specific configuration directory.
 * Looks for the optional platform config npm package first,
 * then falls back to a local config directory in the server folder.
 */
function findConfigDir() {
  const platform = process.platform;
  const configPkg = PLATFORM_PKG_MAP[platform];

  if (!configPkg) {
    return null;
  }

  // Try optional platform package
  try {
    const pkgDir = path.dirname(require.resolve(`${configPkg}/package.json`));
    const configDirName = PLATFORM_CONFIG_MAP[platform];
    const configDir = path.join(pkgDir, configDirName);
    if (fs.existsSync(configDir)) {
      return configDir;
    }
  } catch {
    // Package not installed
  }

  // Fallback: look in server/ directory (for manual installs)
  const serverDir = path.join(__dirname, '..', 'server');
  const configDirName = PLATFORM_CONFIG_MAP[platform];
  const localConfig = path.join(serverDir, configDirName);
  if (fs.existsSync(localConfig)) {
    return localConfig;
  }

  return null;
}

/**
 * Find the Eclipse Equinox launcher jar in the plugins directory.
 */
function findLauncherJar(serverDir) {
  const pluginsDir = path.join(serverDir, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    return null;
  }

  const files = fs.readdirSync(pluginsDir);
  const launcher = files.find(f => f.startsWith('org.eclipse.equinox.launcher_') && f.endsWith('.jar'));
  if (launcher) {
    return path.join(pluginsDir, launcher);
  }

  return null;
}

/**
 * Get or create the workspace data directory.
 * Each project gets its own workspace to avoid conflicts.
 */
function getWorkspaceDir(config) {
  if (config && config.workspace && config.workspace.dataDir) {
    return config.workspace.dataDir;
  }

  // Create a unique workspace per project based on cwd hash
  const crypto = require('crypto');
  const cwd = config && config.repositoryPath ? config.repositoryPath : process.cwd();
  const hash = crypto.createHash('md5').update(cwd).digest('hex').substring(0, 8);
  const projectName = path.basename(cwd);

  const dataDir = path.join(
    process.env.HOME || process.env.USERPROFILE || '/tmp',
    '.jdtls-workspace',
    `${projectName}-${hash}`
  );

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
}

/**
 * Get the path to the platform-specific native binary (if any).
 */
function getBinaryPath() {
  // For Java LS, the "binary" is the java executable
  return findJava({});
}

module.exports = {
  findJava,
  findConfigDir,
  findLauncherJar,
  getWorkspaceDir,
  getBinaryPath,
  PLATFORM_CONFIG_MAP,
  PLATFORM_PKG_MAP,
};
