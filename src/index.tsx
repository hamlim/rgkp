import path from 'path'
import fs from 'fs'
import traverse from '@babel/traverse'
import { parse, ParserPlugin } from '@babel/parser'

interface Dependency {
  filename: string
  dependencies: Array<Dependency>
}

function collectDependencies({
  filename,
  resolveBabelParseOptions,
  resolveAmbiguousImportedFileExtension,
}: {
  filename: string
  resolveBabelParseOptions: ResolveBabelParseOptions
  resolveAmbiguousImportedFileExtension: ResolveAmbiguousImportedFileExtension
}): Array<Dependency> {
  let fileExtension = path.extname(filename)
  let content = fs.readFileSync(filename, 'utf-8')
  let ast = parse(content, {
    sourceType: 'module',
    ...resolveBabelParseOptions({ filename, content }),
  })
  let imports = []
  traverse(ast, {
    ImportDeclaration(path) {
      imports.push(path.node.source.value)
    },
  })
  let deps = []
  for (let importSource of imports) {
    if (importSource.startsWith('.')) {
      let fullpath = path.join(path.dirname(filename), importSource)
      // this might not be correct, e.g.
      // A.tsx might import B.js, or B.mdx
      if (path.extname(fullpath) === '') {
        let importedFileExtension = resolveAmbiguousImportedFileExtension({
          source: filename,
          imported: fullpath,
        })
        fullpath += importedFileExtension
      }
      if (fs.existsSync(fullpath)) {
        deps.push({
          filename: fullpath,
          dependencies: collectDependencies({
            filename: fullpath,
            resolveBabelParseOptions,
            resolveAmbiguousImportedFileExtension,
          }),
        })
      }
    } else if (
      importSource.startsWith('http') ||
      importSource.startsWith('//')
    ) {
      // Absolute import to a URL
      // ignore it here, we'll leave this as-is
      deps.push({
        filename: importSource,
        dependencies: [],
      })
    } else {
      // ambiguous import, e.g. `import 'react';`
      deps.push({
        filename: importSource,
        dependencies: [],
      })
    }
  }
  return deps
}

function buildGraph({
  source,
  resolveBabelParseOptions,
  resolveAmbiguousImportedFileExtension,
}: {
  source: string
  resolveBabelParseOptions: ResolveBabelParseOptions
  resolveAmbiguousImportedFileExtension: ResolveAmbiguousImportedFileExtension
}): Dependency {
  let entryDependency: Dependency = {
    filename: source,
    dependencies: collectDependencies({
      filename: source,
      resolveBabelParseOptions,
      resolveAmbiguousImportedFileExtension,
    }),
  }
  return entryDependency
}

type ResolveBabelParseOptions = (arg: {
  filename: string
  content: string
}) => ParseOptions

type ResolveAmbiguousImportedFileExtension = (arg: {
  source: string
  imported: string
}) => string

export interface RgkpConfig {
  source: string
  resolveBabelParseOptions?: ResolveBabelParseOptions
  resolveAmbiguousImportedFileExtension?: ResolveAmbiguousImportedFileExtension
}

interface ParseOptions {
  plugins: Array<ParserPlugin>
}

function defaultResolveBabelParseOptions({
  filename,
  content,
}: {
  filename: string
  content: string
}): ParseOptions {
  let flow = content.includes('@flow')
  let typescript = path.extname(filename).includes('.ts')
  return {
    plugins: ['jsx', flow && 'flow', typescript && 'typescript'].filter(
      Boolean,
    ) as Array<ParserPlugin>,
  }
}

function defaultResolveAmbiguousImportedFileExtension({
  source,
  imported,
}: {
  source: string
  imported: string
}): string {
  let sourceFileExtension = path.extname(source)
  if (fs.existsSync(imported + sourceFileExtension)) {
    return sourceFileExtension
  } else if (fs.existsSync(imported + '.ts')) {
    return '.ts'
  } else if (fs.existsSync(imported + '.js')) {
    return '.js'
  }
  throw new Error(
    `

Can't find reasonable file extension for ${imported} when resolving from ${source}

Attempted: '${sourceFileExtension}', '.ts', '.js'

Does this file exist locally?

`,
  )
}

export default async function main({
  source,
  resolveBabelParseOptions: _resolveBabelParseOptions,
  resolveAmbiguousImportedFileExtension: _resolveAmbiguousImportedFileExtension,
}: RgkpConfig) {
  let resolveBabelParseOptions =
    typeof _resolveBabelParseOptions === 'function'
      ? _resolveBabelParseOptions
      : defaultResolveBabelParseOptions
  let resolveAmbiguousImportedFileExtension =
    typeof _resolveAmbiguousImportedFileExtension === 'function'
      ? _resolveAmbiguousImportedFileExtension
      : defaultResolveAmbiguousImportedFileExtension
  let currentWorkingDirectory = process.cwd()
  // Build up dependency graph
  let graph = buildGraph({
    source: path.join(currentWorkingDirectory, source),
    resolveBabelParseOptions,
    resolveAmbiguousImportedFileExtension,
  })
  console.log(graph)
}
