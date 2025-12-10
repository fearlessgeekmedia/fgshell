'use strict'

const arrayPad = require('array-pad')
const ffn = require('ffn')
const isGlobalObject = require('is-global-object')
const isNil = require('is-nil')
const isObject = require('is-object')
const ofn = require('ofn')
const plainify = require('plainify')
const set = require('lodash.set')
const wfn = require('wfn')

module.exports = ofn([2, 0, 1], (options, bcPath, f) => wfn(f, function supportBindOperator () {
  const {arg: i = 0, path = bcPath, ignoreThis} = plainify('arg', options)
  const args = arrayPad(Array.from(arguments), i)
  if (!isNil(this) && !isGlobalObject(this) && !ffn(ignoreThis, {blacklist: true})(this)) {
    if (path) {
      if (!isObject(args[i])) args[i] = {}
      set(args[i], path, this)
    } else {
      args.splice(i, 0, this)
    }
  }
  return f.apply(this, args)
}))
