'use strict'

const pfn = require('pfn')
const supportBindOperator = require('sbo')

module.exports = supportBindOperator(function rtrimArray (arr, trim) {
  const shouldTrim = pfn(trim, Array.isArray(trim) ? el => trim.includes(el) : el => el === trim)
  let i; for (i = arr.length - 1; i >= 0; i--) if (!shouldTrim(arr[i])) break
  return Array.from(arr).slice(0, i + 1)
})
