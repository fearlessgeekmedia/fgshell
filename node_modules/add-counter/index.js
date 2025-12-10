'use strict'

module.exports = function * (iter, i = 0) { for (const x of iter) yield [i++, x] }
