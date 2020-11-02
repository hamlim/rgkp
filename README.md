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
import rgkp from 'rgkp'

rgkp({
  source: 'path/to/file.tsx',
  resolveBabelParseOptions({ filename, content }) {
    return {
      plugins: ['jsx', 'typescript'],
    }
  },
})
```
