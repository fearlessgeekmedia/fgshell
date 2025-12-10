'use strict'

const every = require('@lamansky/every')
const isArrayOfLength = require('is-array-of-length')
const isInstanceOf = require('is-instance-of')
const isIterable = require('is-iterable')
const isObject = require('is-object')
const map = require('map-iter')
const otherwise = require('otherwise')
const sbo = require('sbo')

module.exports = sbo(function toMap (x, {arrays = [], convertMaps = true, elseCall, elseReturn = new Map(), elseThrow, detectPairs = true, maps = [], mirror = false} = {}) {
  if (x instanceof Map) return x
  if (isInstanceOf(x, maps)) return convertMaps ? new Map(x.entries()) : x
  if (isIterable(x) && typeof x !== 'string') {
    return new Map(
      detectPairs && every(x, el => isArrayOfLength(el, 2))
        ? x
        : mirror
          ? map(x, el => [el, el])
          : map(x, (el, i) => [i, el])
      ,
    )
  }
  if (isObject(x)) return new Map(Object.entries(x))
  return otherwise({elseCall, elseReturn, elseThrow}, {defaultErrorClass: TypeError})
})
