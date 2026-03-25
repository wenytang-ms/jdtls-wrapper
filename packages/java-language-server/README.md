# @vscjava/java-language-server

Java Language Server (Eclipse JDT LS wrapper) distributed via npm, designed for integration with GitHub Copilot CLI.

## Overview

This package wraps [Eclipse JDT Language Server](https://github.com/eclipse-jdtls/eclipse.jdt.ls) and distributes it via npm following the same platform-specific pattern used by `@vscjava/cpp-language-server`.

## Installation

```bash
npm install -g @vscjava/java-language-server
```

The installation automatically downloads the correct platform configuration for your OS.
To bundle a JRE (no separate Java install needed):

```bash
npm install -g @vscjava/java-language-server @vscjava/java-ls-jre-win32-x64
```

## Prerequisites

- **Node.js** >= 16
- **Java 21+** (unless using the bundled JRE package)

## Usage

### Standalone

```bash
jdtls --stdio
```

### With Copilot CLI

Add to `~/.copilot/lsp-config.json`:

```json
{
  "lspServers": {
    "java": {
      "command": "jdtls",
      "args": ["--stdio"],
      "fileExtensions": {
        ".java": "java"
      }
    }
  }
}
```

### Project Configuration

Create `java-lsp.json` in your project root:

```json
{
  "repositoryPath": "/path/to/project",
  "java": {
    "home": null,
    "vmargs": ["-Xmx2G"]
  },
  "project": {
    "type": "auto",
    "importOnStartup": true
  }
}
```

## Java Runtime Resolution Order

1. Bundled JRE (optional `@vscjava/java-ls-jre-*` package)
2. `java.home` in `java-lsp.json`
3. `JAVA_HOME` environment variable
4. `java` on system PATH

## Architecture

```
@vscjava/java-language-server          (main package - Node.js shell + shared JARs)
├── bin/jdtls.js                       (entry point)
├── lib/install.js                     (platform detection, JVM resolution)
├── lib/detect.js                      (Maven/Gradle project detection)
├── server/plugins/                    (Eclipse JDT LS jars - cross-platform)
└── optionalDependencies:
    ├── @vscjava/java-ls-config-*      (platform-specific launcher config)
    └── @vscjava/java-ls-jre-*         (optional bundled JRE)
```

## Server Files

After installing, place the jdtls server files in `server/`:

```bash
# Download jdtls
curl -L https://download.eclipse.org/jdtls/milestones/1.40.0/jdt-language-server-1.40.0-202410311350.tar.gz | tar xz -C node_modules/@vscjava/java-language-server/server/
```

## License

EPL-2.0 (Eclipse JDT LS), see individual packages for details.
