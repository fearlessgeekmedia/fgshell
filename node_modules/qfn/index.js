'use strict'

const pfn = require('pfn')
const wfn = require('wfn')

module.exports = (fn, test = false) => {
  test = pfn(test, test)
  return wfn(fn, function qfn () {
    return test.apply(this, arguments) ? fn.apply(this, arguments) : arguments[0]
  })
}
