'use strict'

const defProps = require('def-props')

module.exports = (...args) => defProps({}, ...args)
