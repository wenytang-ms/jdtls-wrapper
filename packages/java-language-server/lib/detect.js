'use strict';

const path = require('path');
const fs = require('fs');

const PROJECT_TYPES = {
  MAVEN: 'maven',
  GRADLE: 'gradle',
  UNKNOWN: 'unknown',
};

const BUILD_FILES = {
  [PROJECT_TYPES.MAVEN]: ['pom.xml'],
  [PROJECT_TYPES.GRADLE]: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'],
};

/**
 * Detect the Java project type by looking for build files.
 * Searches from the given directory upward to the filesystem root.
 */
function detectProject(startDir) {
  let dir = startDir || process.cwd();

  while (dir) {
    // Check Maven
    for (const buildFile of BUILD_FILES[PROJECT_TYPES.MAVEN]) {
      const fullPath = path.join(dir, buildFile);
      if (fs.existsSync(fullPath)) {
        return {
          type: PROJECT_TYPES.MAVEN,
          buildFile: fullPath,
          projectRoot: dir,
          settings: detectMavenSettings(dir),
        };
      }
    }

    // Check Gradle
    for (const buildFile of BUILD_FILES[PROJECT_TYPES.GRADLE]) {
      const fullPath = path.join(dir, buildFile);
      if (fs.existsSync(fullPath)) {
        return {
          type: PROJECT_TYPES.GRADLE,
          buildFile: fullPath,
          projectRoot: dir,
          settings: detectGradleSettings(dir),
        };
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return {
    type: PROJECT_TYPES.UNKNOWN,
    buildFile: null,
    projectRoot: startDir,
    settings: {},
  };
}

/**
 * Detect Maven-specific settings.
 */
function detectMavenSettings(projectRoot) {
  const settings = {
    hasWrapper: false,
    isMultiModule: false,
  };

  // Check for Maven wrapper
  const wrapperScript = process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw';
  settings.hasWrapper = fs.existsSync(path.join(projectRoot, wrapperScript));

  // Check for multi-module (look for <modules> in pom.xml)
  try {
    const pomContent = fs.readFileSync(path.join(projectRoot, 'pom.xml'), 'utf8');
    settings.isMultiModule = /<modules>/.test(pomContent);
  } catch {
    // Ignore read errors
  }

  return settings;
}

/**
 * Detect Gradle-specific settings.
 */
function detectGradleSettings(projectRoot) {
  const settings = {
    hasWrapper: false,
    isKotlinDsl: false,
    isMultiProject: false,
  };

  // Check for Gradle wrapper
  const wrapperScript = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
  settings.hasWrapper = fs.existsSync(path.join(projectRoot, wrapperScript));

  // Check for Kotlin DSL
  settings.isKotlinDsl = fs.existsSync(path.join(projectRoot, 'build.gradle.kts'))
    || fs.existsSync(path.join(projectRoot, 'settings.gradle.kts'));

  // Check for multi-project (settings.gradle exists with include)
  const settingsFile = settings.isKotlinDsl ? 'settings.gradle.kts' : 'settings.gradle';
  try {
    const content = fs.readFileSync(path.join(projectRoot, settingsFile), 'utf8');
    settings.isMultiProject = /include\s*[("']/.test(content);
  } catch {
    // Ignore read errors
  }

  return settings;
}

module.exports = {
  detectProject,
  PROJECT_TYPES,
};
