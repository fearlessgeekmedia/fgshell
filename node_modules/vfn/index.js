'use strict'

const arrayPad = require('array-pad')
const isPlainObject = require('is-plain-object')
const plainify = require('plainify')
const wfn = require('wfn')

module.exports = (o, fn) => wfn(fn, function vfn () {
  const {arg: i = 0, oo} = plainify('arg', o)
  const origArgs = Array.from(arguments)

  let options
  if (oo && origArgs.length && isPlainObject(origArgs[origArgs.length - 1])) options = origArgs.pop()

  const newArgs = arrayPad(origArgs, i)
  newArgs.splice(i, 0, origArgs.length < fn.length ? [] : newArgs.splice(i, origArgs.length - fn.length + 1))

  if (options) newArgs.push(options)

  return fn.apply(this, newArgs) // eslint-disable-line no-invalid-this
})
