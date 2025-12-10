'use strict'

module.exports = require('sbo')(items => Array.from(items).sort((a, b) => b.length - a.length))
