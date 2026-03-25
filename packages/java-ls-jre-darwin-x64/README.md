# Bundled JRE: macOS x64

Optional Java 21 runtime for `@vscjava/java-language-server`.

Install this package to avoid requiring a separate Java installation:

```bash
npm install @vscjava/java-ls-jre-darwin-x64
```

## Contents

- `jre/` — Minimal Java 21 JRE (jlink-generated)

## Building

Use `jlink` to create a minimal JRE:

```bash
jlink --module-path $JAVA_HOME/jmods \
  --add-modules java.base,java.logging,java.xml,java.naming,java.desktop,java.management,java.instrument,java.security.jgss,java.sql \
  --output jre \
  --strip-debug \
  --no-man-pages \
  --no-header-files \
  --compress=2
```

Requires a Java 21+ JDK on a macOS Intel system.
