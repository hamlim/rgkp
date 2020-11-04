# rgkp

Transform a collection of source files into a browser compatible collection of
files.

## Install and Run

```sh
yarn add -D rgkp
```

```sh
yarn rgkp ./src/application.tsx
```

## Usage via Node:

```tsx
import rgkp, { RgkpConfig } from 'rgkp'

rgkp({
  source: 'path/to/file.tsx',
  // Optional
  // Function to return `@babel/parser`'s `parse` options
  // Will be merged with `'sourceType': 'module'`
  resolveBabelParseOptions({ filename, content }) {
    return {
      plugins: ['jsx', 'typescript'],
    }
  },
  // Optional
  // Function to return the file extension for any ambiguous imports
  // e.g. `import './Counter'`
  // Will be called with `source` which is the full filepath to the file importing the ambiguous file
  // and with `imported`, the import specifier encountered
  resolveAmbiguousImportedFileExtension({ source, imported }) {
    return `.tsx`
  },
  // Optional
  // Function to resolve the NPM dependencies of a project to URL's
  // Note: Many of the defaults here _may_ not be what you want!
  resolveAmbiguousDependencies(packageJSON) {
    return {
      react: `https://unpkg.com/react@16.14.0/umd/react.production.min.js`,
    }
  },
})
```
