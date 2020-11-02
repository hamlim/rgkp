# rgkp

Transform a collection of source files into a browser compatible collection of
files.

## Install and Setup

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
  // Optional function to return `@babel/parser`'s `parse` options
  // Will be merged with `'sourceType': 'module'`
  resolveBabelParseOptions({ filename, content }) {
    return {
      plugins: ['jsx', 'typescript'],
    }
  },
})
```
