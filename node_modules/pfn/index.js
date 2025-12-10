'use strict'

const f = x => typeof x === 'function'

module.exports = (x, or = a => a) => f(x) ? x : f(or) ? or : () => or
