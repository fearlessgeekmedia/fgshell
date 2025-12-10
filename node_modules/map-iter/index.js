'use strict'

module.exports = require('sbo')(function * map (iter, cb) {
  let i = 0
  for (const x of iter) yield cb(x, i++)
})
