'use strict'

const assert = require('assert')
const hasDuplicates = require('.')

describe('hasDuplicates()', function () {
  it('should return true if there are duplicates in an array', function () {
    assert(hasDuplicates([1, 1]))
  })

  it('should return false if there are no duplicates in an array', function () {
    assert(!hasDuplicates([1, 2]))
  })

  it('should return false if the array is empty', function () {
    assert(!hasDuplicates([]))
  })

  it('should return true if there are duplicate characters in a string', function () {
    assert(hasDuplicates('aa'))
  })

  it('should return false if there are no duplicate characters in a string', function () {
    assert(!hasDuplicates('ab'))
  })

  it('should return false if the string is empty', function () {
    assert(!hasDuplicates(''))
  })
})
