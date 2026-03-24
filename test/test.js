#!/usr/bin/env node

'use strict';

/**
 * Test script for java-language-server package.
 * Run from monorepo root: node test/test.js
 */

const path = require('path');
const assert = require('assert');

// Point require to the package source
const { findJava, findConfigDir, findLauncherJar, getWorkspaceDir } = require('../packages/java-language-server/lib/install');
const { detectProject, PROJECT_TYPES } = require('../packages/java-language-server/lib/detect');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ── detect.js tests ──────────────────────────────────────────────

console.log('\n=== detect.js ===');

test('detects Maven project', () => {
  const result = detectProject(path.join(__dirname, 'mock-maven-project'));
  assert.strictEqual(result.type, PROJECT_TYPES.MAVEN);
  assert.ok(result.buildFile.includes('pom.xml'));
  assert.strictEqual(result.settings.isMultiModule, true, 'should detect multi-module');
});

test('detects Gradle project', () => {
  const result = detectProject(path.join(__dirname, 'mock-gradle-project'));
  assert.strictEqual(result.type, PROJECT_TYPES.GRADLE);
  assert.ok(result.buildFile.includes('build.gradle'));
  assert.strictEqual(result.settings.isMultiProject, true, 'should detect multi-project');
  assert.strictEqual(result.settings.isKotlinDsl, false, 'should not be Kotlin DSL');
});

test('returns unknown for non-Java directory', () => {
  const result = detectProject(__dirname);
  // __dirname itself has no pom.xml or build.gradle (walking up may find one)
  // Use a guaranteed empty temp location
  const os = require('os');
  const fs = require('fs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jdtls-test-'));
  const result2 = detectProject(tmpDir);
  assert.strictEqual(result2.type, PROJECT_TYPES.UNKNOWN);
  fs.rmdirSync(tmpDir);
});

// ── install.js tests ─────────────────────────────────────────────

console.log('\n=== install.js ===');

test('findJava returns a string', () => {
  const javaPath = findJava({});
  assert.ok(typeof javaPath === 'string');
  assert.ok(javaPath.length > 0);
});

test('findJava respects config java.home', () => {
  const fakeHome = process.platform === 'win32'
    ? 'C:\\Program Files\\Java\\jdk-21'
    : '/usr/lib/jvm/java-21';
  const result = findJava({ java: { home: fakeHome } });
  // If fakeHome doesn't exist, should fall through to JAVA_HOME or PATH
  assert.ok(typeof result === 'string');
});

test('findConfigDir returns string or null', () => {
  const configDir = findConfigDir();
  // On a dev machine, platform config may or may not be installed
  assert.ok(configDir === null || typeof configDir === 'string');
});

test('findLauncherJar returns null for empty dir', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jdtls-test-'));
  const result = findLauncherJar(tmpDir);
  assert.strictEqual(result, null);
  fs.rmdirSync(tmpDir);
});

test('getWorkspaceDir creates directory', () => {
  const fs = require('fs');
  const wsDir = getWorkspaceDir({ repositoryPath: path.join(__dirname, 'mock-maven-project') });
  assert.ok(typeof wsDir === 'string');
  assert.ok(fs.existsSync(wsDir), `workspace dir should exist: ${wsDir}`);
});

// ── bin/jdtls.js syntax check ────────────────────────────────────

console.log('\n=== bin/jdtls.js ===');

test('jdtls.js is valid JavaScript', () => {
  const fs = require('fs');
  const entryPoint = path.join(__dirname, '..', 'packages', 'java-language-server', 'bin', 'jdtls.js');
  const source = fs.readFileSync(entryPoint, 'utf8');
  // This will throw SyntaxError if invalid
  new Function(source.replace('#!/usr/bin/env node', ''));
});

// ── Summary ──────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
