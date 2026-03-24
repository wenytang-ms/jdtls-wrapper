# Bundled JRE: Linux x64

Optional Java 21 runtime for `@myscope/java-language-server`.

Install this package to avoid requiring a separate Java installation:

```bash
npm install @myscope/java-ls-jre-linux-x64
```

## Contents

- `jre/` — Minimal Java 21 JRE (jlink-generated)

## Building

Use `jlink` to create a minimal JRE:

```bash
jlink --module-path $JAVA_HOME/jmods \
  --add-modules java.base,java.compiler,java.logging,java.management,java.naming,java.prefs,java.sql,java.xml,jdk.compiler,jdk.management,jdk.unsupported,jdk.zipfs \
  --strip-debug --no-man-pages --no-header-files \
  --output jre
```
