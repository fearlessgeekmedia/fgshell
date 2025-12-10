'use strict'

const f = x => typeof x === 'function'
const nil = require('is-nil')
const toss = err => { throw err }

module.exports = (x, or = a => a) => f(x) ? x : nil(x) ? (f(or) ? or : () => or)
  : toss(new TypeError('Value cannot be a non-function'))
