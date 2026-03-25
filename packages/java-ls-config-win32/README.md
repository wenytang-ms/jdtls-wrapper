# Platform Configuration: Windows

This package contains the platform-specific Eclipse Equinox launcher configuration for Windows.

## Contents

- `config_win/` — OS-specific launcher jars and native libraries

## Note

This package is an `optionalDependency` of `@msinternal/java-language-server`. 
It is automatically skipped on non-Windows platforms via the `"os": ["win32"]` field in `package.json`.

## Populating config_win/

Extract from the official jdtls release:

```bash
tar xzf jdt-language-server-*.tar.gz config_win/
```
