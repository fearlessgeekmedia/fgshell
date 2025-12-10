'use strict'

const f = x => typeof x === 'function'
const cc = require('class-chain')
const sbo = require('sbo')

module.exports = sbo((sub, cls) => f(sub) && (f(cls) ? cc : cc.names)(sub).includes(cls))
