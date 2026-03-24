#!/usr/bin/env node

'use strict';

/**
 * Downloads and extracts Eclipse JDT Language Server into the correct package directories.
 *
 * Usage:
 *   node scripts/download-jdtls.js [version]
 *
 * Example:
 *   node scripts/download-jdtls.js 1.40.0
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_VERSION = '1.57.0';
const DEFAULT_TIMESTAMP = '202602261110';

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const SERVER_DIR = path.join(PACKAGES_DIR, 'java-language-server', 'server');

function getDownloadUrl(version, timestamp) {
  return `https://download.eclipse.org/jdtls/milestones/${version}/jdt-language-server-${version}-${timestamp}.tar.gz`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes) {
          const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stderr.write(`\r  Progress: ${pct}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('\n  Download complete.');
        resolve(dest);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

function extractTarGz(archive, destDir) {
  console.log(`Extracting to: ${destDir}`);
  fs.mkdirSync(destDir, { recursive: true });

  // Use tar if available, otherwise provide instructions
  try {
    execSync(`tar xzf "${archive}" -C "${destDir}"`, { stdio: 'inherit' });
    console.log('  Extraction complete.');
  } catch (e) {
    console.error('  Failed to extract with tar. Please extract manually:');
    console.error(`  tar xzf "${archive}" -C "${destDir}"`);
    process.exit(1);
  }
}

function distributeFiles(extractDir) {
  console.log('\nDistributing files to packages...');

  // Move plugins/ and features/ to main server dir
  const dirs = ['plugins', 'features'];
  for (const dir of dirs) {
    const src = path.join(extractDir, dir);
    const dest = path.join(SERVER_DIR, dir);
    if (fs.existsSync(src)) {
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true });
      }
      fs.renameSync(src, dest);
      console.log(`  ${dir}/ → packages/java-language-server/server/${dir}/`);
    }
  }

  // Move config_* to respective platform packages
  const configMap = {
    config_win: path.join(PACKAGES_DIR, 'java-ls-config-win32', 'config_win'),
    config_linux: path.join(PACKAGES_DIR, 'java-ls-config-linux', 'config_linux'),
    config_mac: path.join(PACKAGES_DIR, 'java-ls-config-darwin', 'config_mac'),
    config_ss: null, // Skip config_ss if present (Solaris)
  };

  for (const [dirName, destPath] of Object.entries(configMap)) {
    const src = path.join(extractDir, dirName);
    if (fs.existsSync(src) && destPath) {
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true });
      }
      fs.renameSync(src, destPath);
      console.log(`  ${dirName}/ → ${path.relative(PACKAGES_DIR, destPath)}/`);
    }
  }

  // Copy lombok.jar if present
  const lombokSrc = path.join(extractDir, 'lombok.jar');
  if (fs.existsSync(lombokSrc)) {
    const lombokDest = path.join(SERVER_DIR, 'lombok.jar');
    fs.copyFileSync(lombokSrc, lombokDest);
    console.log('  lombok.jar → packages/java-language-server/server/lombok.jar');
  }
}

async function main() {
  const version = process.argv[2] || DEFAULT_VERSION;
  const timestamp = process.argv[3] || DEFAULT_TIMESTAMP;

  console.log(`\nJDT LS Download Script`);
  console.log(`Version: ${version}`);
  console.log(`Timestamp: ${timestamp}\n`);

  const url = getDownloadUrl(version, timestamp);
  const tmpDir = path.join(__dirname, '..', '.tmp');
  const archivePath = path.join(tmpDir, `jdt-language-server-${version}.tar.gz`);
  const extractDir = path.join(tmpDir, 'jdtls');

  // Clean and create temp dir
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await download(url, archivePath);
    extractTarGz(archivePath, extractDir);
    distributeFiles(extractDir);

    console.log('\n✓ jdtls files distributed successfully!');
    console.log('\nNext steps:');
    console.log('  1. (Optional) Build JRE packages with jlink on each target platform');
    console.log('  2. Publish packages: npm run publish-all');
  } finally {
    // Cleanup
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
      console.log('\nCleaned up temporary files.');
    }
  }
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
