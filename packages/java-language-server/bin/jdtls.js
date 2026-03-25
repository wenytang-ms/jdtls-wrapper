#!/usr/bin/env node

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { findJava, findConfigDir, findLauncherJar, getWorkspaceDir } = require('../lib/install');
const { detectProject } = require('../lib/detect');

const SERVER_DIR = path.join(__dirname, '..', 'server');

function loadConfig() {
  let dir = process.cwd();
  while (dir) {
    const configPath = path.join(dir, 'java-lsp.json');
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.error(`Warning: Failed to parse ${configPath}: ${e.message}`);
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

function buildArgs(config) {
  const javaExe = findJava(config);
  if (!javaExe) {
    console.error('ERROR: Java 21+ runtime not found.');
    console.error('Install Java 21+ and set JAVA_HOME, or install the optional JRE package:');
    console.error(`  npm install @vscjava/java-ls-jre-${process.platform}-${process.arch}`);
    process.exit(1);
  }

  const configDir = findConfigDir();
  if (!configDir) {
    console.error(`ERROR: No platform configuration found for ${process.platform}.`);
    console.error('Supported platforms: win32, linux, darwin');
    process.exit(1);
  }

  const launcher = findLauncherJar(SERVER_DIR);
  if (!launcher) {
    console.error('ERROR: Eclipse Equinox launcher jar not found in server/plugins/.');
    console.error('The package may be corrupted. Try reinstalling.');
    process.exit(1);
  }

  const workspaceDir = getWorkspaceDir(config);
  const vmargs = (config.java && config.java.vmargs) || ['-Xmx1G'];

  const args = [
    ...vmargs,
    '-Declipse.application=org.eclipse.jdt.ls.core.id1',
    '-Dosgi.bundles.defaultStartLevel=4',
    '-Dosgi.checkConfiguration=true',
    '-Declipse.product=org.eclipse.jdt.ls.core.product',
    '-Dlog.level=ALL',
    '--add-modules=ALL-SYSTEM',
    '--add-opens', 'java.base/java.util=ALL-UNNAMED',
    '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
    '-jar', launcher,
    '-configuration', configDir,
    '-data', workspaceDir,
  ];

  args.push(...process.argv.slice(2));

  return { javaExe, args };
}

/**
 * Encode a JSON-RPC message with Content-Length header for LSP protocol.
 */
function encodeLspMessage(msg) {
  const json = JSON.stringify(msg);
  const byteLength = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${byteLength}\r\n\r\n${json}`;
}

/**
 * Fix malformed file:// URIs.
 * Copilot CLI sends "file://C:\path" but LSP spec requires "file:///C:/path".
 */
function fixFileUri(uri) {
  if (!uri || !uri.startsWith('file://')) return uri;
  // Remove the file:// prefix
  let path = uri.substring(7);
  // Replace backslashes with forward slashes
  path = path.replace(/\\/g, '/');
  // Ensure leading slash for absolute paths (e.g., "C:/..." → "/C:/...")
  if (path.match(/^[A-Za-z]:/)) {
    path = '/' + path;
  }
  // Ensure it doesn't already have the triple slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return 'file://' + path;
}

/**
 * Fix rootUri and workspaceFolders in an initialize request message.
 */
function fixInitializeRequest(text) {
  const headerEnd = text.indexOf('\r\n\r\n');
  if (headerEnd === -1) return text;

  const header = text.substring(0, headerEnd);
  const body = text.substring(headerEnd + 4);

  try {
    const msg = JSON.parse(body);
    if (!msg.params) return text;

    let modified = false;

    if (msg.params.rootUri) {
      const fixed = fixFileUri(msg.params.rootUri);
      if (fixed !== msg.params.rootUri) {
        console.error(`[jdtls-proxy] Fixed rootUri: ${msg.params.rootUri} → ${fixed}`);
        msg.params.rootUri = fixed;
        modified = true;
      }
    }

    if (msg.params.rootPath) {
      msg.params.rootPath = msg.params.rootPath.replace(/\\/g, '/');
    }

    if (Array.isArray(msg.params.workspaceFolders)) {
      for (const folder of msg.params.workspaceFolders) {
        if (folder.uri) {
          const fixed = fixFileUri(folder.uri);
          if (fixed !== folder.uri) {
            console.error(`[jdtls-proxy] Fixed workspace folder URI: ${folder.uri} → ${fixed}`);
            folder.uri = fixed;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      return encodeLspMessage(msg);
    }
  } catch {
    // Not valid JSON, return as-is
  }

  return text;
}

/**
 * Lightweight LSP proxy that:
 * 1. Fixes malformed file:// URIs in initialize requests
 * 2. Automatically sends 'initialized' notification to jdtls
 */
function createLspProxy(child) {
  let sentInitialized = false;
  let clientBuffer = '';
  let buffering = true;

  // Client → Server: intercept initialize request to fix URIs
  process.stdin.on('data', (chunk) => {
    if (!buffering) {
      // After init handshake, direct passthrough
      child.stdin.write(chunk);
      return;
    }

    clientBuffer += chunk.toString('utf8');

    // Check if we have a complete initialize request
    if (clientBuffer.includes('"method":"initialize"') || clientBuffer.includes('"method": "initialize"')) {
      const headerEnd = clientBuffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const header = clientBuffer.substring(0, headerEnd);
        const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (lengthMatch) {
          const contentLength = parseInt(lengthMatch[1], 10);
          const bodyStart = headerEnd + 4;
          if (clientBuffer.length >= bodyStart + contentLength) {
            // We have the complete initialize message
            const fullMessage = clientBuffer.substring(0, bodyStart + contentLength);
            const remaining = clientBuffer.substring(bodyStart + contentLength);

            // Fix URIs and forward
            const fixed = fixInitializeRequest(fullMessage);
            child.stdin.write(fixed);

            // Forward any remaining data
            if (remaining.length > 0) {
              child.stdin.write(remaining);
            }

            buffering = false;
            sentInitialized = true;
            clientBuffer = '';

            // Send initialized notification after server processes initialize
            setTimeout(() => {
              console.error('[jdtls-proxy] Sending initialized notification to server');
              const initialized = encodeLspMessage({ jsonrpc: '2.0', method: 'initialized', params: {} });
              child.stdin.write(initialized);
            }, 3000);

            // Switch to direct piping
            process.stdin.removeAllListeners('data');
            process.stdin.pipe(child.stdin);
            return;
          }
        }
      }
    }

    // If buffer gets too big without finding initialize, flush and passthrough
    if (clientBuffer.length > 50000) {
      child.stdin.write(clientBuffer);
      clientBuffer = '';
      buffering = false;
      process.stdin.removeAllListeners('data');
      process.stdin.pipe(child.stdin);
    }
  });

  // Server → Client: direct passthrough (no interception needed)
  child.stdout.pipe(process.stdout);

  // Forward server stderr to our stderr
  child.stderr.pipe(process.stderr);
}

function main() {
  const config = loadConfig();

  const projectInfo = detectProject(config.repositoryPath || process.cwd());
  if (projectInfo.type !== 'unknown') {
    console.error(`Detected ${projectInfo.type} project: ${projectInfo.buildFile}`);
  }

  const { javaExe, args } = buildArgs(config);

  console.error(`Starting jdtls with: ${javaExe}`);

  const child = spawn(javaExe, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: false,
    env: { ...process.env },
  });

  // Set up the LSP proxy to inject 'initialized' notification
  createLspProxy(child);

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code || 0);
    }
  });

  child.on('error', (err) => {
    console.error(`Failed to start jdtls: ${err.message}`);
    if (err.code === 'ENOENT') {
      console.error(`Java executable not found at: ${javaExe}`);
      console.error('Ensure Java 21+ is installed and JAVA_HOME is set correctly.');
    }
    process.exit(1);
  });

  // Handle parent process signals
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
}

main();
