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
}: {
  filename: string
  resolveBabelParseOptions: ResolveBabelParseOptions
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
      if (path.extname(fullpath) === '') {
        fullpath += fileExtension
      }
      if (fs.existsSync(fullpath)) {
        deps.push({
          filename: fullpath,
          dependencies: collectDependencies({
            filename: fullpath,
            resolveBabelParseOptions,
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
}: {
  source: string
  resolveBabelParseOptions: ResolveBabelParseOptions
}): Dependency {
  let entryDependency: Dependency = {
    filename: source,
    dependencies: collectDependencies({
      filename: source,
      resolveBabelParseOptions,
    }),
  }
  return entryDependency
}

type ResolveBabelParseOptions = (arg: {
  filename: string
  content: string
}) => Array<ParserPlugin>

export interface RgkpArgs {
  source: string
  resolveBabelParseOptions?: ResolveBabelParseOptions
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

export default async function main({
  source,
  resolveBabelParseOptions: _resolveBabelParseOptions,
}: RgkpArgs) {
  let resolveBabelParseOptions =
    typeof _resolveBabelParseOptions === 'function'
      ? _resolveBabelParseOptions
      : defaultResolveBabelParseOptions
  let currentWorkingDirectory = process.cwd()
  // Build up dependency graph
  let graph = buildGraph({
    source: path.join(currentWorkingDirectory, source),
    resolveBabelParseOptions,
  })
  console.log(graph)
}
