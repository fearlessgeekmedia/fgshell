'use strict'

const assert = require('assert')
const ci = require('.')

describe('ci()', function () {
  it('should throw an error if input is not array or string', function () {
    assert.throws(() => { ci(new Map()) })
  })
})

describe('CaseInsensitiveArray', function () {
  describe('#equals()', function () {
    it('should return true if equal', function () {
      assert(ci(['Test']).equals(['test']))
    })

    it('should return false if unequal', function () {
      assert(!ci(['Test']).equals(['something else']))
    })
  })

  describe('#includes()', function () {
    it('should return true if element included', function () {
      assert(ci(['Test']).includes('TEST'))
    })

    it('should return false if element not included', function () {
      assert(!ci(['Test']).includes('testing'))
    })
  })

  describe('#indexOf()', function () {
    it('should return index of included element', function () {
      assert.strictEqual(ci(['Test']).indexOf('TEST'), 0)
    })

    it('should return -1 if element not included', function () {
      assert.strictEqual(ci(['Test']).indexOf('testing'), -1)
    })
  })

  describe('#lastIndexOf()', function () {
    it('should return last index of included element', function () {
      assert.strictEqual(ci(['A', 'A']).lastIndexOf('a'), 1)
    })

    it('should return -1 if element not included', function () {
      assert.strictEqual(ci(['A', 'A']).lastIndexOf('b'), -1)
    })
  })
})

describe('CaseInsensitiveString', function () {
  describe('#endsWith()', function () {
    it('should return true if ends with substring', function () {
      assert(ci('test').endsWith('sT'))
    })

    it('should return false if does not end with substring', function () {
      assert(!ci('test').endsWith('es'))
    })
  })

  describe('#equals()', function () {
    it('should return true if equal', function () {
      assert(ci('test').equals('Test'))
    })

    it('should return false if unequal', function () {
      assert(!ci('test').equals('something else'))
    })
  })

  describe('#includes()', function () {
    it('should return true if substring included', function () {
      assert(ci('Test').includes('ES'))
    })

    it('should return false if substring not included', function () {
      assert(!ci('Test').includes('ing'))
    })
  })

  describe('#indexOf()', function () {
    it('should return index of included substring', function () {
      assert.strictEqual(ci('Test').indexOf('t'), 0)
    })

    it('should return -1 if substring not included', function () {
      assert.strictEqual(ci('Test').indexOf('x'), -1)
    })
  })

  describe('#lastIndexOf()', function () {
    it('should return last index of included substring', function () {
      assert.strictEqual(ci('Test').lastIndexOf('T'), 3)
    })

    it('should return -1 if substring not included', function () {
      assert.strictEqual(ci('Test').lastIndexOf('x'), -1)
    })
  })

  describe('#startsWith()', function () {
    it('should return true if starts with substring', function () {
      assert(ci('test').startsWith('T'))
    })

    it('should return false if does not start with substring', function () {
      assert(!ci('test').startsWith('es'))
    })
  })
})
