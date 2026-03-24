# Platform Configuration: macOS

This package contains the platform-specific Eclipse Equinox launcher configuration for macOS.

## Contents

- `config_mac/` — OS-specific launcher jars and native libraries

## Note

This package is an `optionalDependency` of `@myscope/java-language-server`.
It is automatically skipped on non-macOS platforms via the `"os": ["darwin"]` field in `package.json`.
