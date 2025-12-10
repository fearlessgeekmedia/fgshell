'use strict'

const addCounter = require('add-counter')
const every = require('@lamansky/every')
const isArrayOfLength = require('is-array-of-length')
const isInstanceOf = require('is-instance-of')
const isIterable = require('is-iterable')
const isObject = require('is-object')
const map = require('map-iter')
const newObject = require('new-object')
const otherwise = require('otherwise')
const sbo = require('sbo')

module.exports = sbo(function toObject (x, {arrays = [], descriptors: descDefaults, elseCall, elseReturn = {}, elseThrow, maps = [], mirror = false, throwIfEquivKeys = true} = {}) {
  if (isInstanceOf(x, [Map, maps])) return newObject(x.entries(), {descDefaults, throwIfEquivKeys})
  if (isIterable(x) && typeof x !== 'string') {
    if (every(x, el => isArrayOfLength(el, 2))) return newObject(x, {descDefaults, throwIfEquivKeys})
    if (mirror) return newObject(map(x, v => [v, v]), {descDefaults, throwIfEquivKeys})
    return newObject(addCounter(x), {descDefaults})
  }
  if (isObject(x)) return x
  return otherwise({elseCall, elseReturn, elseThrow}, {defaultErrorClass: TypeError})
})
