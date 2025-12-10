'use strict'

const toArray = require('./array')
const toIterator = require('./iterator')
const toMap = require('./map')
const toNumber = require('./number')
const toObject = require('./object')
const toStr = require('./string')

module.exports = {
  toArray, toIterator, toMap, toNumber, toObject, toString: toStr, toStr,
}
