'use strict'

const isPlainObject = require('is-plain-object')

module.exports = (key, x) => isPlainObject(x) ? x : typeof x === 'undefined' ? {} : {[key]: x}
