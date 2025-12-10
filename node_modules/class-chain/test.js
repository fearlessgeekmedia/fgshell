'use strict'

const assert = require('assert')
const getClassChain = require('.')

class A {}
class B {}
class B1 extends B {}

describe('getClassChain()', function () {
  it('should return an empty array for primitives', function () {
    assert.strictEqual(getClassChain('test').length, 0)
  })

  it('should return an empty array for a plain object', function () {
    assert.strictEqual(getClassChain({}).length, 0)
  })

  it('should return an empty array for an object with a null prototype', function () {
    assert.strictEqual(getClassChain(Object.create(null)).length, 0)
  })

  it('should return an empty array for a nameless function', function () {
    assert.strictEqual(getClassChain(function () {}).length, 0)
  })

  it('should return the wrapper class for a wrapped primitive', function () {
    const classes = getClassChain(new String('test')) // eslint-disable-line no-new-wrappers
    assert.strictEqual(classes.length, 1)
    assert.strictEqual(classes[0], String)
  })

  it('should return single class when given non-extending class', function () {
    const classes = getClassChain(A)
    assert.strictEqual(classes.length, 1)
    assert.strictEqual(classes[0], A)
  })

  it('should return single class when given instance of non-extending class', function () {
    const classes = getClassChain(new A())
    assert.strictEqual(classes.length, 1)
    assert.strictEqual(classes[0], A)
  })

  it('should return multiple classes when given extending class', function () {
    const classes = getClassChain(B1)
    assert.strictEqual(classes.length, 2)
    assert.strictEqual(classes[0], B1)
    assert.strictEqual(classes[1], B)
  })

  it('should return multiple classes when given instance of extending class', function () {
    const classes = getClassChain(new B1())
    assert.strictEqual(classes.length, 2)
    assert.strictEqual(classes[0], B1)
    assert.strictEqual(classes[1], B)
  })
})

describe('getClassChain.names()', function () {
  it('should return an empty array for invalid input', function () {
    assert.strictEqual(getClassChain.names('test').length, 0)
  })

  it('should return the wrapper class name for a wrapped primitive', function () {
    const classes = getClassChain.names(new String('test')) // eslint-disable-line no-new-wrappers
    assert.strictEqual(classes.length, 1)
    assert.strictEqual(classes[0], 'String')
  })

  it('should return multiple class names when given instance of extending class', function () {
    const classes = getClassChain.names(new B1())
    assert.strictEqual(classes.length, 2)
    assert.strictEqual(classes[0], 'B1')
    assert.strictEqual(classes[1], 'B')
  })
})
