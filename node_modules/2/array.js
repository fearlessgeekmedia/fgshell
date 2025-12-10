'use strict'

const isInstanceOf = require('is-instance-of')
const isIterable = require('is-iterable')
const isNil = require('is-nil')
const isObject = require('is-object')
const sbo = require('sbo')

module.exports = sbo(function toArray (x, {arrays = [], convertArrays, detectIndexKeys = false, maps = []} = {}) {
  if (isNil(x) || Number.isNaN(x)) return []
  if (Array.isArray(x) || (isInstanceOf(x, arrays) && !convertArrays)) return x
  if (isInstanceOf(x, [Map, maps])) return Array.from(detectIndexKeys && keysLookLikeIndexes(x.keys()) ? x.values() : x)
  if (isIterable(x) && typeof x !== 'string') return Array.from(x)
  if (isObject(x)) return detectIndexKeys && keysLookLikeIndexes(Object.keys(x).sort()) ? Object.values(x) : Object.entries(x)
  return [x]
})

function keysLookLikeIndexes (keys) {
  let i = 0
  for (const key of keys) {
    if (key !== i && key !== String(i)) return false
    i++
  }
  return i > 0
}
