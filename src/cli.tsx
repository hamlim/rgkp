#!/usr/bin/env node
import main from './index'

let source = process.argv[2]

main({
  source,
}).catch((err) => {
  throw err
})
