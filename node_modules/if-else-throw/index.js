'use strict'

const PossibleFunction = require('possible-function')

module.exports = function (test, val, err = new Error()) {
  if (!(err instanceof Error)) err = new Error(err)
  if (PossibleFunction(test, test)(val)) return val; else throw err
}
