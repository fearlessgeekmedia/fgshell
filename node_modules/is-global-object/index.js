'use strict'

const g = typeof global !== 'undefined'
const w = typeof window !== 'undefined'

module.exports = x => (g && x === global) || (w && x === window)
