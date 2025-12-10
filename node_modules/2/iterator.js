'use strict'

const emptyIterator = require('empty-iterator')
const isIterable = require('is-iterable')
const isNil = require('is-nil')
const sbo = require('sbo')

module.exports = sbo(function toIterator (x) {
  if (isNil(x) || Number.isNaN(x)) return emptyIterator()
  if (typeof x !== 'object') return [x][Symbol.iterator]()
  if (isIterable(x)) return x[Symbol.iterator]() // Arrays, Sets, Maps, etc.
  return Object.entries(x)[Symbol.iterator]() // Objects
})
