'use strict'

const assert = require('assert')
const {toArray, toIterator, toMap, toNumber, toObject, toString: toStr} = require('.')

describe('2', function () {
  describe('#toArray()', function () {
    it('should convert array to array', function () {
      const array = []
      assert.strictEqual(toArray(array), array)
    })

    it('should convert arguments object to array', function () {
      const array = ['first', 'second']

      function argumentsTest () {
        const args = toArray(arguments)
        assert(Array.isArray(args))
        assert.strictEqual(JSON.stringify(args), JSON.stringify(array))
      }

      argumentsTest.apply(null, array)
    })

    it('should convert Map to array', function () {
      const array = [['a', 'b']]
      const map = new Map(array)
      assert.strictEqual(JSON.stringify(toArray(map)), JSON.stringify(array))
    })

    it('should `detectIndexKeys` of array-like Map', function () {
      const map = new Map([[0, 'a'], ['1', 'b']])
      assert.strictEqual(JSON.stringify(toArray(map, {detectIndexKeys: true})), JSON.stringify(['a', 'b']))
    })

    it('should convert Set to array', function () {
      const array = [1, 2, 3]
      const set = new Set(array)
      assert.strictEqual(JSON.stringify(toArray(set)), JSON.stringify(array))
    })

    it('should convert object to array of key/value pairs', function () {
      const object = {a: 1, b: 2, c: 3}
      const array = [['a', 1], ['b', 2], ['c', 3]]
      assert.strictEqual(JSON.stringify(toArray(object)), JSON.stringify(array))
    })

    it('should `detectIndexKeys` of array-like object', function () {
      const object = {0: 'a', 1: 'b'}
      assert.strictEqual(JSON.stringify(toArray(object, {detectIndexKeys: true})), JSON.stringify(['a', 'b']))
    })

    it('should `detectIndexKeys` of array-like object with nonsequential keys', function () {
      const object = {1: 'b', 0: 'a'}
      assert.strictEqual(JSON.stringify(toArray(object, {detectIndexKeys: true})), JSON.stringify(['a', 'b']))
    })

    it('should convert primitive value to single-element array', function () {
      assert.strictEqual(JSON.stringify(toArray('test')), JSON.stringify(['test']))
    })

    for (const value of [undefined, null, NaN]) { // eslint-disable-line no-undefined
      it(`should convert ${value} to empty array`, function () {
        assert.strictEqual(JSON.stringify(toArray(value)), JSON.stringify([]))
      })
    }
  })

  describe('#toIterator()', function () {
    it('should convert primitive value to single-run iterator', function () {
      const iterator = toIterator('test')
      assert.strictEqual(typeof iterator, 'object')
      assert.strictEqual(typeof iterator.next, 'function')
      let r = iterator.next()
      assert.notStrictEqual(r.done, true)
      assert.strictEqual(r.value, 'test')
      r = iterator.next()
      assert.strictEqual(r.done, true)
    })

    const valueTests = [
      ['should convert array to iterator', [1, 2]],
      ['should convert Set to iterator', new Set([1, 2])],
    ]

    for (const [description, object] of valueTests) {
      it(description, function () {
        const iterator = toIterator(object)
        assert.strictEqual(typeof iterator, 'object')
        assert.strictEqual(typeof iterator.next, 'function')
        let r = iterator.next()
        assert.notStrictEqual(r.done, true)
        assert.strictEqual(r.value, 1)
        r = iterator.next()
        assert.notStrictEqual(r.done, true)
        assert.strictEqual(r.value, 2)
        r = iterator.next()
        assert.strictEqual(r.done, true)
      })
    }

    const keyValueTests = [
      ['should convert Map to iterator', new Map([['a', 1], ['b', 2]])],
      ['should convert object to iterator', {a: 1, b: 2}],
    ]

    for (const [description, object] of keyValueTests) {
      it(description, function () {
        const iterator = toIterator(object)
        assert.strictEqual(typeof iterator, 'object')
        assert.strictEqual(typeof iterator.next, 'function')
        let r = iterator.next()
        assert.notStrictEqual(r.done, true)
        assert(Array.isArray(r.value))
        assert.strictEqual(r.value.length, 2)
        assert.strictEqual(r.value[0], 'a')
        assert.strictEqual(r.value[1], 1)
        r = iterator.next()
        assert.notStrictEqual(r.done, true)
        assert(Array.isArray(r.value))
        assert.strictEqual(r.value.length, 2)
        assert.strictEqual(r.value[0], 'b')
        assert.strictEqual(r.value[1], 2)
        r = iterator.next()
        assert.strictEqual(r.done, true)
      })
    }

    for (const value of [undefined, null, NaN]) { // eslint-disable-line no-undefined
      it(`should convert ${value} to empty iterator`, function () {
        const iterator = toIterator(value)
        assert.strictEqual(typeof iterator, 'object')
        const r = iterator.next()
        assert.strictEqual(r.done, true)
      })
    }
  })

  describe('#toMap()', function () {
    it('should convert Map to Map', function () {
      assert(toMap(new Map()) instanceof Map)
    })

    it('should convert array of key/value pairs to Map', function () {
      const map = toMap([['a', 1], ['b', 2]])
      assert.strictEqual(map.get('a'), 1)
      assert.strictEqual(map.get('b'), 2)
    })

    it('should convert values-only array to Map', function () {
      const a = {}
      const b = []
      const map = toMap([a, b])
      assert.strictEqual(map.get(0), a)
      assert.strictEqual(map.get(1), b)
    })

    it('should `mirror` array across keys and values', function () {
      const map = toMap(['100', 200], {mirror: true})
      assert.strictEqual(map.get('100'), '100')
      assert.strictEqual(map.get(200), 200)
    })

    it('should convert object to Map', function () {
      const map = toMap({a: 1, b: 2})
      assert.strictEqual(map.get('a'), 1)
      assert.strictEqual(map.get('b'), 2)
    })

    it('should convert primitive value to empty Map', function () {
      const map = toMap('not a map')
      assert(map instanceof Map)
      assert.strictEqual(map.size, 0)
    })

    it('should return the provided fallback if input is unconvertible', function () {
      const map = toMap('not a map', {elseReturn: new Map([['a', 1], ['b', 2]])})
      assert.strictEqual(map.get('a'), 1)
      assert.strictEqual(map.get('b'), 2)
    })

    it('should throw `elseThrow` if input is unconvertible', function () {
      assert.throws(() => { toMap('not a map', {elseThrow: TypeError}) }, TypeError)
    })
  })

  describe('#toNumber()', function () {
    it('should convert number to number', function () {
      assert.strictEqual(toNumber(1), 1)
    })

    it('should convert Number object to number', function () {
      assert.strictEqual(toNumber(new Number(1)), 1) // eslint-disable-line no-new-wrappers
    })

    it('should convert integer string to number', function () {
      assert.strictEqual(toNumber('100'), 100)
    })

    it('should convert integer String object to number', function () {
      assert.strictEqual(toNumber(new String('100')), 100) // eslint-disable-line no-new-wrappers
    })

    it('should convert float string to number', function () {
      assert.strictEqual(toNumber('1.2'), 1.2)
    })

    it('should convert negative number string to number', function () {
      assert.strictEqual(toNumber('-1.2'), -1.2)
      assert.strictEqual(toNumber('−123'), -123)
      assert.strictEqual(toNumber('−123K'), -123000)
      assert.strictEqual(toNumber('0−123'), 0) // Invalid
      assert.strictEqual(toNumber('(123.45)'), -123.45)
      assert.strictEqual(toNumber('(-123.45)'), 0) // Invalid
      assert.strictEqual(toNumber('123.45)'), 0) // Invalid
      assert.strictEqual(toNumber('(123.45'), 0) // Invalid
    })

    it('should support digit grouping', function () {
      assert.strictEqual(toNumber('1,000'), 1000)
      assert.strictEqual(toNumber('1 000'), 1000)
      assert.strictEqual(toNumber('1 000'), 1000)
      assert.strictEqual(toNumber('1.000'), 1)
      assert.strictEqual(toNumber('1.00'), 1)
      assert.strictEqual(toNumber('1,234.56'), 1234.56)
      assert.strictEqual(toNumber('12,34,567.89'), 1234567.89)
    })

    it('should support decimal comma syntax', function () {
      assert.strictEqual(toNumber('1.000', {decimalComma: true}), 1000)
      assert.strictEqual(toNumber('1,234'), 1234)
      assert.strictEqual(toNumber('1,234', {decimalComma: true}), 1.234)
    })

    it('should return fallback (default 0) for invalid digit grouping', function () {
      assert.strictEqual(toNumber('1 23'), 0)
      assert.strictEqual(toNumber('1,234,56'), 0)
      assert.strictEqual(toNumber('1,2,3'), 0)
      assert.strictEqual(toNumber('1,234,56', {decimalComma: true}), 0)
      assert.strictEqual(toNumber('1,234,56789'), 0)
      assert.strictEqual(toNumber('1,234.567,890'), 0)
      assert.strictEqual(toNumber('1,234 567 890'), 0)
      assert.strictEqual(toNumber('1,2,34,567.89'), 0)
      assert.strictEqual(toNumber('1,2,,34,567.89'), 0)
      assert.strictEqual(toNumber('12,34,56.7'), 0)
    })

    it('should allow contrary punctuation if there’s no ambiguity', function () {
      assert.strictEqual(toNumber('1,23'), 1.23)
      assert.strictEqual(toNumber('1.234,56', {decimalComma: true}), 1234.56)
      assert.strictEqual(toNumber('1.234,56'), 1234.56)
      assert.strictEqual(toNumber('1234,56'), 1234.56)
      assert.strictEqual(toNumber('1,23456'), 1.23456)
      assert.strictEqual(toNumber('1,234.00', {decimalComma: true}), 1234)
      assert.strictEqual(toNumber('1 234.00', {decimalComma: true}), 1234)
      assert.strictEqual(toNumber('1 234.567,890'), 1234567.89)
    })

    it('should support `decimalPlacesInInt`', function () {
      assert.strictEqual(toNumber('1,23', {decimalPlacesInInt: 2}), 123)
      assert.strictEqual(toNumber('1.23', {decimalPlacesInInt: 2}), 123)
      assert.strictEqual(toNumber('1.2345', {decimalPlacesInInt: 2}), 123)
    })

    it('should support k/g/m/b suffixes', function () {
      assert.strictEqual(toNumber('1k'), 1000)
      assert.strictEqual(toNumber('2K'), 2000)
      assert.strictEqual(toNumber('3g'), 3000)
      assert.strictEqual(toNumber('400G'), 400000)
      assert.strictEqual(toNumber('5k0'), 0) // Invalid
      assert.strictEqual(toNumber('5bk'), 0) // Invalid
      assert.strictEqual(toNumber('6m'), 6000000)
      assert.strictEqual(toNumber('7M'), 7000000)
      assert.strictEqual(toNumber('8b'), 8000000000)
      assert.strictEqual(toNumber('9B'), 9000000000)
    })

    it('should guess at bad input if `ignoreBadChars` is `true`', function () {
      assert.strictEqual(toNumber('--1', {ignoreBadChars: true}), -1)
      assert.strictEqual(toNumber('1,234,56789', {ignoreBadChars: true}), 1234.56789)
      assert.strictEqual(toNumber('1,234,56789', {ignoreBadChars: true, decimalPlacesInInt: 2}), 123456)
      assert.strictEqual(toNumber('1,2,,34,567.89', {ignoreBadChars: true}), 1234567.89)
      assert.strictEqual(toNumber('1,000', {ignoreBadChars: true}), 1000)
      assert.strictEqual(toNumber('5k0', {ignoreBadChars: true}), 50)
      assert.strictEqual(toNumber('5bk', {ignoreBadChars: true}), 5000)
      assert.strictEqual(toNumber('5)', {ignoreBadChars: true}), 5)
      assert.strictEqual(toNumber('This is 1 number', {ignoreBadChars: true}), 1)
      assert.strictEqual(toNumber('This is Infinity!', {finite: false, ignoreBadChars: true}), Infinity)
      assert.strictEqual(toNumber('not a number', {ignoreBadChars: true, elseReturn: 100}), 100)
    })

    it('should round float to integer if `round` is true', function () {
      assert.strictEqual(toNumber(4.7, {round: true}), 5)
    })

    it('should return fallback (default 0) for Infinity', function () {
      assert.strictEqual(toNumber(Infinity), 0)
    })

    it('should allow +Infinity if `finite` is false', function () {
      assert.strictEqual(toNumber(Infinity, {finite: false}), Infinity)
    })

    it('should allow -Infinity if `finite` is false', function () {
      assert.strictEqual(toNumber(-Infinity, {finite: false}), -Infinity)
    })

    it('should convert string representations of Infinity', function () {
      assert.strictEqual(toNumber('Infinity', {finite: false}), Infinity)
      assert.strictEqual(toNumber('infinity', {finite: false}), Infinity)

      assert.strictEqual(toNumber('-Infinity', {finite: false}), -Infinity)
      assert.strictEqual(toNumber('−Infinity', {finite: false}), -Infinity)
      assert.strictEqual(toNumber('−infinity', {finite: false}), -Infinity)

      assert.strictEqual(toNumber('Infinity'), 0)
      assert.strictEqual(toNumber('--Infinity', {finite: false}), 0) // Invalid
    })

    it('should return fallback (default 0) for NaN', function () {
      assert.strictEqual(toNumber(NaN), 0)
    })

    it('should return fallback (default 0) for null', function () {
      assert.strictEqual(toNumber(null), 0)
    })

    it('should return fallback (default 0) for undefined', function () {
      assert.strictEqual(toNumber(undefined), 0) // eslint-disable-line no-undefined
    })

    it('should return 0 if number is invalid and no fallback provided', function () {
      assert.strictEqual(toNumber('not a number'), 0)
    })

    it('should return `elseReturn` if number is unconvertible', function () {
      assert.strictEqual(toNumber('not a number', {elseReturn: 2}), 2)
    })

    it('should not round `elseReturn` if `round` is true', function () {
      assert.strictEqual(toNumber({}, {elseReturn: 3.3, round: true}), 3.3)
    })

    it('should throw `elseThrow` if input is unconvertible', function () {
      assert.throws(() => { toNumber('not a number', {elseThrow: new RangeError()}) }, RangeError)
    })
  })

  describe('#toObject()', function () {
    it('should convert object to object', function () {
      const object = {a: 1, b: 2}
      assert.strictEqual(JSON.stringify(toObject(object)), JSON.stringify(object))
    })

    it('should convert array of key/value pairs to object', function () {
      const object = toObject([['a', 1], ['b', 2]])
      assert.strictEqual(object.a, 1)
      assert.strictEqual(object.b, 2)
    })

    it('should convert array of strings to object with numerical keys', function () {
      const object = toObject(['a', 'b'])
      assert.strictEqual(object[0], 'a')
      assert.strictEqual(object[1], 'b')
    })

    it('should `mirror` string array across keys and values', function () {
      const object = toObject(['100', '200'], {mirror: true})
      assert.strictEqual(object[100], '100')
      assert.strictEqual(object[200], '200')
    })

    it('should throw if mirrored values would be string-equivalent keys', function () {
      toObject(['100', {}], {mirror: true})
      assert.throws(() => { toObject(['100', {}, {}], {mirror: true}) })
    })

    it('should convert Map to object', function () {
      const object = toObject(new Map([['a', 1], ['b', 2]]))
      assert.strictEqual(object.a, 1)
      assert.strictEqual(object.b, 2)
    })

    it('should convert primitive value to empty object', function () {
      assert.strictEqual(JSON.stringify(toObject('not an object')), JSON.stringify({}))
    })

    it('should return `elseReturn` if input is unconvertible', function () {
      assert.strictEqual(JSON.stringify(toObject('not an object', {elseReturn: {a: 1}})), JSON.stringify({a: 1}))
    })

    it('should throw error if Map has keys that are not strings/numbers', function () {
      assert.throws(() => { toObject(new Map([{}, 'test'])) }, TypeError)
    })

    it('should accept property descriptor settings', function () {
      const map = new Map([['a', 1], ['b', 2]])

      {
        const object = toObject(map, {descriptors: {}})
        assert.strictEqual(Object.entries(object).length, 0)
        assert.strictEqual(object.a, 1)
        assert.strictEqual(object.b, 2)
      }

      {
        const object = toObject(map, {descriptors: {enumerable: true}})
        assert.strictEqual(Object.entries(object).length, 2)
        assert.throws(() => { object.a = 3 })
      }
    })
  })

  describe('#toString()', function () {
    it('should convert string to string', function () {
      assert.strictEqual(toStr('test'), 'test')
    })

    it('should convert String object to string', function () {
      assert.strictEqual(typeof toStr(new String('test')), typeof 'test') // eslint-disable-line no-new-wrappers
    })

    it('should convert number to string', function () {
      assert.strictEqual(toStr(-123), '-123')
    })

    it('should convert 0 to "0"', function () {
      assert.strictEqual(toStr(0), '0')
    })

    it('should convert -0 to "0"', function () {
      assert.strictEqual(toStr(-0), '0')
    })

    it('should convert NaN to empty string', function () {
      assert.strictEqual(toStr(NaN), '')
    })

    it('should convert Infinity to empty string', function () {
      assert.strictEqual(toStr(Infinity), '')
    })

    it('should convert true to empty string', function () {
      assert.strictEqual(toStr(true), '')
    })

    it('should convert false to empty string', function () {
      assert.strictEqual(toStr(true), '')
    })

    it('should convert null to empty string', function () {
      assert.strictEqual(toStr(null), '')
    })

    it('should convert undefined to empty string', function () {
      assert.strictEqual(toStr(undefined), '') // eslint-disable-line no-undefined
    })

    it('should convert function to empty string', function () {
      assert.strictEqual(toStr(function () {}), '')
    })

    it('should convert array to empty string', function () {
      assert.strictEqual(toStr([]), '')
    })

    it('should convert plain object to empty string', function () {
      assert.strictEqual(toStr({}), '')
    })

    it('should convert symbol to empty string', function () {
      assert.strictEqual(toStr(Symbol('test')), '')
    })

    it('should convert object to string using object’s custom toString() method', function () {
      class TestClass {
        toString () {
          return 'string value'
        }
      }
      const object = new TestClass()
      assert.strictEqual(toStr(object), 'string value')
    })

    it('should return `elseReturn` if input is unconvertible', function () {
      assert.strictEqual(toStr({}, {elseReturn: 'test'}), 'test')
    })

    it('should throw `elseThrow` if input is unconvertible', function () {
      assert.throws(() => { toStr({}, {elseThrow: true}) }, TypeError)
    })
  })

  it('should result in object surviving multiple chained conversions', function () {
    let data = {a: 1, b: 2}
    data = toMap(data)
    data = toArray(data)
    data = toObject(data)
    data = toIterator(data)
    data = toArray(data)
    data = toMap(data)
    data = toObject(data)
    assert.strictEqual(Object.keys(data).length, 2)
    assert.strictEqual(data.a, 1)
    assert.strictEqual(data.b, 2)
  })

  it('should result in array surviving multiple chained conversions', function () {
    let data = ['first', 'second']
    data = toMap(data)
    data = toArray(data, {detectIndexKeys: true})
    data = toObject(data)
    data = toIterator(data)
    data = toArray(data, {detectIndexKeys: true})
    data = toMap(data)
    data = toObject(data)
    data = toArray(data, {detectIndexKeys: true})
    assert.strictEqual(JSON.stringify(data), JSON.stringify(['first', 'second']))
  })
})
