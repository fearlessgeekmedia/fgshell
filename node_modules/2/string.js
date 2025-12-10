'use strict'

const isObject = require('is-object')
const otherwise = require('otherwise')
const sbo = require('sbo')

module.exports = sbo(function toStr (x, {elseCall, elseReturn = '', elseThrow} = {}) {
  if (typeof x === 'string') return x
  if (x instanceof String || Number.isFinite(x) || (isObject(x) && x.toString !== Object.prototype.toString)) return String(x)
  return otherwise({elseCall, elseReturn, elseThrow}, {defaultErrorClass: TypeError})
})
