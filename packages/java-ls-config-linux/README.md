# Platform Configuration: Linux

This package contains the platform-specific Eclipse Equinox launcher configuration for Linux.

## Contents

- `config_linux/` — OS-specific launcher jars and native libraries

## Note

This package is an `optionalDependency` of `@myscope/java-language-server`.
It is automatically skipped on non-Linux platforms via the `"os": ["linux"]` field in `package.json`.
