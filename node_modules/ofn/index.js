'use strict'

const hasDuplicates = require('has-duplicates')
const wfn = require('wfn')

module.exports = function (argPrecedence, fn) {
  if (!Array.isArray(argPrecedence)) throw new TypeError('ofn argument 1 must be an array')
  if (hasDuplicates(argPrecedence)) throw new Error('ofn argument 1 array cannot have duplicates')
  if (argPrecedence.some(i => !Number.isInteger(i))) throw new TypeError('ofn argument 1 array must contain only numbers')
  if (argPrecedence.some(i => i < 0 || i >= argPrecedence.length)) throw new RangeError('ofn argument 1 array has a number out of range')

  if (typeof fn !== 'function') throw new TypeError('ofn argument 2 must be a function')

  return wfn(fn, function ofn () {
    const callArgs = []
    const argIndexes = argPrecedence.slice(0, arguments.length).sort()
    for (let i = 0; i < arguments.length; i++) {
      callArgs[i < argIndexes.length ? argIndexes[i] : i] = arguments[i]
    }
    return fn.apply(this, callArgs)
  })
}
