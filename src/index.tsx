import path from 'path'
import fs from 'fs'
import traverse from '@babel/traverse'
import { parse, ParserPlugin } from '@babel/parser'
import { importDeclaration, stringLiteral } from '@babel/types'
import esbuild from 'esbuild'
import mdx from '@mdx-js/mdx'

type AssetType = 'javascript' | 'typescript' | 'mdx' | 'unknown'

interface Dependency {
  filename: string
  type: AssetType
  dependencies: Array<Dependency>
}

interface ParseOptions {
  plugins: Array<ParserPlugin>
}

interface PackageJSON {
  dependencies: {
    [dependency: string]: string
  }
  version: string
}

interface ResolvedDependencyMap {
  [dependency: string]: string
}

type ResolveBabelParseOptions = (arg: {
  filename: string
  content: string
}) => ParseOptions

type ResolveAmbiguousImportedFileExtension = (arg: {
  source: string
  imported: string
}) => string

type ResolveAmbiguousDependencies = (
  packageJSON: PackageJSON,
) => ResolvedDependencyMap

export interface RgkpConfig {
  source: string
  resolveBabelParseOptions?: ResolveBabelParseOptions
  resolveAmbiguousImportedFileExtension?: ResolveAmbiguousImportedFileExtension
  resolveAmbiguousDependencies?: ResolveAmbiguousDependencies
}

function getAssetType(source: string): AssetType {
  let extension = path.extname(source)
  switch (extension) {
    case '.js':
    case '.jsx':
      return 'javascript'
    case '.ts':
    case '.tsx':
      return 'typescript'
    case '.mdx':
    case '.md':
      return 'mdx'
    default:
      return 'unknown'
  }
}

function collectDependencies({
  filename,
  dependencyMap,
  resolveBabelParseOptions,
  resolveAmbiguousImportedFileExtension,
}: {
  filename: string
  dependencyMap: ResolvedDependencyMap
  resolveBabelParseOptions: ResolveBabelParseOptions
  resolveAmbiguousImportedFileExtension: ResolveAmbiguousImportedFileExtension
}): Array<Dependency> {
  let content = fs.readFileSync(filename, 'utf-8')
  let ast = parse(content, {
    sourceType: 'module',
    ...resolveBabelParseOptions({ filename, content }),
  })
  let imports = []
  traverse(ast, {
    ImportDeclaration(path) {
      let importedFrom = path.node.source.value
      if (
        !importedFrom.startsWith('.') &&
        !importedFrom.startsWith('/') &&
        !importedFrom.startsWith('//') &&
        !importedFrom.startsWith('http')
      ) {
        if (dependencyMap[importedFrom]) {
          path.replaceWith(
            importDeclaration(
              path.node.specifiers,
              stringLiteral(dependencyMap[importedFrom]),
            ),
          )
        }
      } else if (importedFrom.startsWith('.') || importedFrom.startsWith('/')) {
        imports.push(path.node.source.value)
      }
    },
  })
  let deps = []
  for (let importSource of imports) {
    if (importSource.startsWith('http') || importSource.startsWith('//')) {
      // Absolute import to a URL
      // ignore it here, we'll leave this as-is
      deps.push({
        filename: importSource,
        type: getAssetType(importSource),
        dependencies: [],
      })
    } else if (importSource.startsWith('.') || importSource.startsWith('/')) {
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
          type: getAssetType(fullpath),
          dependencies: collectDependencies({
            filename: fullpath,
            dependencyMap,
            resolveBabelParseOptions,
            resolveAmbiguousImportedFileExtension,
          }),
        })
      }
    } else {
      // ambiguous import, e.g. `import 'react';`
      deps.push({
        filename: importSource,
        type: getAssetType(importSource),
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
  dependencyMap,
}: {
  source: string
  resolveBabelParseOptions: ResolveBabelParseOptions
  resolveAmbiguousImportedFileExtension: ResolveAmbiguousImportedFileExtension
  dependencyMap: ResolvedDependencyMap
}): Dependency {
  let entryDependency: Dependency = {
    filename: source,
    type: getAssetType(source),
    dependencies: collectDependencies({
      filename: source,
      resolveBabelParseOptions,
      resolveAmbiguousImportedFileExtension,
      dependencyMap,
    }),
  }
  return entryDependency
}

function findPackageJSON({
  currentWorkingDirectory,
}: {
  currentWorkingDirectory: string
}): PackageJSON {
  let currentPath = currentWorkingDirectory
  let root = path.parse(currentPath).root
  while (currentPath !== root) {
    let pjsonPath = path.join(currentPath, 'package.json')
    if (fs.existsSync(pjsonPath)) {
      return require(pjsonPath)
    } else {
      currentPath = path.resolve(currentPath, '..')
    }
  }
  throw new Error(
    `Couldn't find package.json within current path or any parent paths!`,
  )
}

// Default Methods
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

function defaultResolveAmbiguousDependencies(
  packageJSON: PackageJSON,
): ResolvedDependencyMap {
  return Object.entries(packageJSON.dependencies || {}).reduce(
    (acc, [dependency, version]) => {
      return {
        ...acc,
        [dependency]: `https://esm.sh/${dependency}@${version}`,
      }
    },
    {},
  )
}

// Main method
export default async function main({
  source,
  resolveBabelParseOptions: _resolveBabelParseOptions,
  resolveAmbiguousImportedFileExtension: _resolveAmbiguousImportedFileExtension,
  resolveAmbiguousDependencies: _resolveAmbiguousDependencies,
}: RgkpConfig) {
  let resolveBabelParseOptions =
    typeof _resolveBabelParseOptions === 'function'
      ? _resolveBabelParseOptions
      : defaultResolveBabelParseOptions
  let resolveAmbiguousImportedFileExtension =
    typeof _resolveAmbiguousImportedFileExtension === 'function'
      ? _resolveAmbiguousImportedFileExtension
      : defaultResolveAmbiguousImportedFileExtension

  let resolveAmbiguousDependencies =
    typeof _resolveAmbiguousDependencies === 'function'
      ? _resolveAmbiguousDependencies
      : defaultResolveAmbiguousDependencies

  let currentWorkingDirectory = process.cwd()

  let packageJSON = findPackageJSON({ currentWorkingDirectory })

  let dependencyMap = resolveAmbiguousDependencies(packageJSON)

  // Build up dependency graph
  let graph = buildGraph({
    source: path.join(currentWorkingDirectory, source),
    resolveBabelParseOptions,
    resolveAmbiguousImportedFileExtension,
    dependencyMap,
  })

  // make temp dir
  let cacheDir = path.join(
    './',
    'node_modules',
    '.rgkp-cache',
    // @TODO
    // Do we want to use something a bit less stable?
    // e.g. Date.now().toString()?
    packageJSON.version,
  )
  fs.mkdirSync(cacheDir, { recursive: true })

  fs.writeFileSync(
    path.join(cacheDir, 'build-graph.json'),
    JSON.stringify(graph),
  )
}
