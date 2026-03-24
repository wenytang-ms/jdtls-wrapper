---
name: check-java-requirements
description: Checks Java runtime and jdtls server availability. Helps diagnose issues when Java LSP fails to start.
---

## Check

Run: `npx --yes @myscope/java-language-server --version`

- If a version number is printed, the package is accessible. Proceed to check Java.
- If it fails with a registry error, the npm package is not accessible.

Then check Java:

Run: `java -version`

- If Java 21+ is found, the runtime is ready.
- If Java is missing or below version 21, proceed to Fix.

## Fix

### 1. Java Runtime Not Found

Install Java 21+:

**Windows:** `winget install Microsoft.OpenJDK.21`
**macOS:** `brew install openjdk@21`
**Linux:** `sudo apt install openjdk-21-jdk` or `sudo dnf install java-21-openjdk-devel`

Or install the bundled JRE package:
```
npm install -g @myscope/java-ls-jre-win32-x64    # Windows
npm install -g @myscope/java-ls-jre-linux-x64     # Linux
npm install -g @myscope/java-ls-jre-darwin-arm64   # macOS ARM
```

### 2. jdtls Server Files Missing

If `npx @myscope/java-language-server --stdio` fails with "launcher jar not found":

```bash
# Download jdtls server files
cd $(npm root -g)/@myscope/java-language-server
node ../../scripts/download-jdtls.js
```

### 3. Re-verify

Run `npx --yes @myscope/java-language-server --version` again to confirm the fix worked.
