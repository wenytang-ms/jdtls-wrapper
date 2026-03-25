# Java Language Server — npm Distribution

Distributes [Eclipse JDT Language Server](https://github.com/eclipse-jdtls/eclipse.jdt.ls) via npm for integration with GitHub Copilot CLI, following the same architecture as `@vscjava/cpp-language-server`.

## Current Status

> **Work in Progress** — The LSP proxy successfully starts jdtls and injects the `initialized` notification.
> However, jdtls does not import Maven/Gradle projects because Copilot CLI's LSP client may not
> pass sufficient `rootUri` or workspace folder information. This is a known limitation that requires
> coordination with the Copilot CLI team.
>
> **What works:** Server startup, `initialize` handshake, `initialized` injection, `initializationOptions`.
>
> **What doesn't work yet:** Project import → code intelligence (documentSymbol, references, etc.).

## Package Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  @vscjava/java-language-server          (main package)           │
│  ├── bin/jdtls.js          Entry point: find JVM → spawn jdtls  │
│  ├── lib/install.js        Platform detection, JVM resolution   │
│  ├── lib/detect.js         Maven / Gradle project detection     │
│  ├── lib/postinstall.js    Post-install verification            │
│  └── server/plugins/       Eclipse JDT LS jars (cross-platform) │
└──────────────┬───────────────────────────────┬───────────────────┘
               │ optionalDependencies          │
       ┌───────┴────────┐            ┌─────────┴──────────┐
       │ Config Packages │            │   JRE Packages      │
       │ (os filtering)  │            │ (os+cpu filtering)  │
       ├─────────────────┤            ├─────────────────────┤
       │ config-win32    │            │ jre-win32-x64       │
       │ config-linux    │            │ jre-linux-x64       │
       │ config-darwin   │            │ jre-darwin-arm64    │
       └─────────────────┘            └─────────────────────┘
       ~2MB each, OS-specific          ~50MB each, optional
       launcher config                 bundled Java 21 JRE
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **JAR distribution** | In main package | JARs are cross-platform; no need for per-OS copies |
| **Platform configs** | Separate packages with `os` filter | Only download config for current OS |
| **JRE bundling** | Optional packages with `os`+`cpu` filter | Users with Java installed skip download |
| **Project detection** | Auto-detect Maven/Gradle | Zero-config for standard projects |

### Comparison with C++ LSP

| | C++ LSP | Java LSP |
|---|---|---|
| Platform binary | ~20MB native exe per platform | ~80MB shared JARs + ~2MB config per platform |
| Runtime | None needed | JVM 21+ (bundled or system) |
| `os` field usage | On binary packages | On config + JRE packages |
| `cpu` field usage | On binary packages | Only on JRE packages |

## Directory Structure

```
javalsp/
├── package.json                    Root monorepo config
├── java-lsp.json.template          Project config template (optional, for edge cases)
├── lsp-config.json.template        Manual LSP integration template (alternative to plugin)
├── scripts/
│   ├── download-jdtls.js           Download & extract jdtls release
│   └── publish.js                  Publish all packages in correct order
├── plugin/                         Copilot CLI plugin (handles LSP registration)
│   ├── .claude-plugin/plugin.json  Plugin metadata + lspServers pointer
│   ├── lsp.json                    LSP launch configuration
│   ├── agency.json                 Plugin category
│   └── skills/                     Diagnostic & troubleshooting skills
├── packages/
│   ├── java-language-server/       Main package (Node.js shell + shared JARs)
│   ├── java-ls-config-win32/       Windows config
│   ├── java-ls-config-linux/       Linux config
│   ├── java-ls-config-darwin/      macOS config
│   ├── java-ls-jre-win32-x64/     Windows JRE (optional)
│   ├── java-ls-jre-linux-x64/     Linux JRE (optional)
│   └── java-ls-jre-darwin-arm64/  macOS JRE (optional)
├── test/                           Test suite + mock projects
└── README.md                       This file
```

## Copilot CLI Plugin Integration

This project follows the same plugin architecture as `@vscjava/cpp-language-server`.

### How it works

```
npm registry                          Copilot CLI
┌─────────────────────┐    npx      ┌────────────────────────────┐
│ @vscjava/            │◄──────────│ plugin/lsp.json             │
│  java-language-server│            │  "command": "npx",          │
│  java-ls-config-*    │            │  "args": ["@vscjava/..."]   │
│  java-ls-jre-*       │            └──────────┬─────────────────┘
└─────────────────────┘                        │ loaded via
                                    ┌──────────┴─────────────────┐
                                    │ .claude-plugin/plugin.json  │
                                    │  "lspServers": "lsp.json"   │
                                    └────────────────────────────┘
                                    ~/.copilot/installed-plugins/
```

The plugin directory tells Copilot CLI **how to start the LSP** (via `lsp.json`).
The npm package contains **the actual LSP binary/jars** (resolved by `npx`).

Both parts are required:
1. **npm package must be reachable** — via `npm publish` (production) or `npm link` (development)
2. **plugin must be installed** — in `~/.copilot/installed-plugins/`

### Plugin file reference

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin metadata (name, version, keywords). `"lspServers": "lsp.json"` tells Copilot CLI to load LSP config. |
| `lsp.json` | Defines how to launch the LSP: command, args, file extensions, timeout. |
| `agency.json` | Plugin category (`"developer-tools"`). |
| `skills/*.md` | Troubleshooting guides that Copilot CLI can invoke automatically. |

## Quick Start

### Local development & testing

```bash
# 1. Download jdtls server files into packages/
node scripts/download-jdtls.js

# 2. Register the npm package locally (makes `npx jdtls` work)
cd packages/java-language-server && npm link

# 3. Install the plugin into Copilot CLI
#    Windows:
copy /s plugin\ %USERPROFILE%\.copilot\installed-plugins\local\java-language-server\
#    macOS/Linux:
cp -r plugin/ ~/.copilot/installed-plugins/local/java-language-server/

# 4. Restart Copilot CLI — Java LSP is now active for .java files

# 5. Run tests to verify
cd ../.. && node test/test.js
```

### Production publishing

```bash
# 1. Download & distribute jdtls files
node scripts/download-jdtls.js

# 2. (Optional) Build minimal JRE on each target platform
jlink --module-path $JAVA_HOME/jmods \
  --add-modules java.base,java.compiler,java.logging,java.management,java.naming,java.prefs,java.sql,java.xml,jdk.compiler,jdk.management,jdk.unsupported,jdk.zipfs \
  --strip-debug --no-man-pages --no-header-files \
  --output packages/java-ls-jre-<platform>/jre

# 3. Publish all packages (platform packages first, then main package)
node scripts/publish.js --access public

# 4. Distribute the plugin/ directory via Copilot CLI marketplace or manual install
```

## Startup Flow

```
Copilot CLI encounters .java file
  │
  ├─ Reads ~/.copilot/installed-plugins/local/java-language-server/
  │   └─ .claude-plugin/plugin.json → "lspServers": "lsp.json"
  │       └─ lsp.json → { "command": "npx", "args": ["@vscjava/java-language-server", "--stdio"] }
  │
  ├─ Executes: npx @vscjava/java-language-server --stdio
  │
  ├─ bin/jdtls.js
  │   ├─ loadConfig()         Read java-lsp.json if present (optional, walk up from cwd)
  │   ├─ detectProject()      Auto-detect pom.xml / build.gradle
  │   └─ buildArgs()
  │       ├─ findJava()       Bundled JRE → config → JAVA_HOME → PATH
  │       ├─ findConfigDir()  Platform config package → local fallback
  │       └─ findLauncherJar() server/plugins/org.eclipse.equinox.launcher_*.jar
  │
  └─ spawn(java, [...jvm args, -jar, launcher, -configuration, configDir, -data, workspace])
       │
       └─ Eclipse JDT LS (LSP over stdio / JSON-RPC 2.0)
            │
            └─ Auto-imports Maven/Gradle project, resolves classpath, builds index
```

## Configuration

### Zero-config (default for standard projects)

For standard Maven or Gradle projects, **no configuration is needed**.
jdtls automatically reads `pom.xml` / `build.gradle` and resolves all classpaths.

### Optional: java-lsp.json (edge cases only)

Create `java-lsp.json` in your project root only if you need to override defaults:

```json
{
  "repositoryPath": "/path/to/project",
  "java": {
    "home": "/path/to/jdk-21",
    "vmargs": ["-Xmx4G"]
  },
  "maven": {
    "userSettings": "~/.m2/settings.xml"
  },
  "project": {
    "referencedLibraries": ["lib/**/*.jar"]
  }
}
```

| Scenario | Config needed? |
|----------|---------------|
| Standard Maven/Gradle project | **None** |
| Need more memory (large project) | `java.vmargs: ["-Xmx4G"]` |
| Specific JDK version | `java.home` |
| Private Maven repository | `maven.userSettings` |
| Plain Java project (no build tool) | `project.referencedLibraries` |

## License

EPL-2.0 (Eclipse JDT LS), GPL-2.0-with-classpath-exception (OpenJDK JRE)
