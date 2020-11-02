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
})
```
