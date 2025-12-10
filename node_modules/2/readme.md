# “2”: The Type Conversion Library

A [Node.js](https://nodejs.org/) module for converting between various JavaScript types: arrays, iterators, maps, numbers, objects, and strings.

```javascript
const {toArray, toIterator, toMap, toNumber, toObject, toString} = require('2')

const obj = {a: 1, b: 2}
obj::toMap()::toArray()::toObject()::toIterator()
  ::toArray()::toMap()::toObject() // {a: 1, b: 2}

let data = '1.23'
data = toNumber(data)
data = toString(data) // '1.23'
```

## Installation

Requires [Node.js](https://nodejs.org/) 8.3.0 or above.

```bash
npm i 2
```

## Usage

### Requiring the Functions

You can require needed functions via a destructuring assignment:

```javascript
const {toArray, toIterator, toMap, toNumber, toObject, toString} = require('2')
```

(If your project has a linting rule that precludes shadowing the global `toString` function, you can also destructure the `toStr` function, which is the same as `toString`.)

You can also require individual functions via submodules:

```javascript
const toArray = require('2/array')
const toIterator = require('2/iterator')
const toMap = require('2/map')
const toNumber = require('2/number')
const toObject = require('2/object')
const toString = require('2/string')
```

### Converting to Arrays
```javascript
const toArray = require('2/array')

// Map => Array
const map = new Map()
map.set('a', 1)
map.set('b', 2)
toArray(map) // [['a', 1], ['b', 2]]

// Iterator => Array
toArray(map.values()) // [1, 2]

// Object => Array
toArray({a: 1, b: 2}) // [['a', 1], ['b', 2]]

// Array-like object => Array
toArray({0: 'first', 1: 'second'}, {detectIndexKeys: true}) // ['first', 'second']

// Primitive value => Array
toArray('test') // ['test']
```

### Converting to Iterators
```javascript
const toIterator = require('2/iterator')

// Object => Iterator
let iterator = toIterator({a: 1, b: 2})
iterator.next().value // ['a', 1]
iterator.next().value // ['b', 2]
iterator.next().done // true

// Primitive value => Iterator
toIterator('test').next().value // 'test'
```

### Converting to Maps
```javascript
const toMap = require('2/map')

// Array of key/value pairs => Map
const map1 = toMap([['a', 1], ['b', 2]])
map1.get('a') // 1
map1.get('b') // 2

// Array of values => Map
const map2 = toMap(['a', 'b'])
map2.get(0) // 'a'
map2.get(1) // 'b'

// Object => Map
const map3 = toMap({a: 1, b: 2})
map3.get('a') // 1
map3.get('b') // 2
```

### Converting to Numbers
```javascript
const toNumber = require('2/number')

toNumber('1.2') // 1.2
toNumber(Infinity) // 0
toNumber(NaN) // 0
toNumber('not a number') // 0

// Can specify a fallback other than zero:
toNumber('not a number', {elseReturn: 100}) // 100

// You can choose to throw an error for invalid inputs.
toNumber('not a number', {elseThrow: true}) // throws error
toNumber('not a number', {elseThrow: new TypeError('Not a number!')})

// Option to round floats:
toNumber('4.7') // 4.7
toNumber('4.7', {round: true}) // 5

// By default, Infinity is not considered a valid number,
// but this can be changed:
toNumber(Infinity) // 0
toNumber(Infinity, {finite: false}) // Infinity

// Number object => Number
const numberObject = new Number(123)
typeof numberObject // 'object'
typeof toNumber(numberObject) // 'number'

// Can parse strings that have digit grouping:
toNumber('1,234') // 1234
// The built-in Number function, on the other hand, cannot:
Number('1,234') // NaN

// Can be configured to interpret the comma as a decimal point:
toNumber('1,234', {decimalComma: true}) // 1.234
```

### Converting to Objects
```javascript
const toObject = require('2/object')

// Array of key/value pairs => Object
const obj1 = toObject([['a', 1], ['b', 2]])
obj1.a // 1
obj1.b // 2

// Array => Object
const obj2 = toObject(['first', 'second'])
Object.keys(obj2).length // 2
obj2[0] // 'first'
obj2[1] // 'second'

// In the above example, the array indices become the object keys.
// But you can make the keys mirror the values instead:
const obj3 = toObject(['first', 'second'], {mirror: true})
Object.keys(obj3).length // 2
obj3.first // 'first'
obj3.second // 'second'

// Map => Object
const map = new Map()
map.set('key1', 'value1')
map.set('key2', 'value2')
const obj4 = toObject(map)
obj4.key1 // 'value1'
obj4.key2 // 'value2'

// Duplicate keys
toObject([['key', 1], ['key', 2]]) // throws an error (default behavior)
const obj5 = toObject([['key', 1], ['key', 2]], {throwIfEquivKeys: false}) // error-throwing disabled
Object.keys(obj5).length // 1
obj5.key // 2

// Setting property descriptors
const obj6 = toObject([['a', 1], ['b', 2]], {descriptors: {enumerable: false}})
Object.keys(obj6).length // 0 (because the properties are non-enumerable)
obj6.a // 1
obj6.b // 2
```

### Converting to Strings
```javascript
const toString = require('2/string')

toString(123) // '123'
toString(-0) // '0'

toString(true) // ''
toString(false) // ''
toString(undefined) // ''
toString(null) // ''
toString(Infinity) // ''
toString(NaN) // ''
toString({}) // ''
toString([]) // ''
toString(function () {}) // ''
toString(Symbol('test')) // ''

// Compare the above to standard JavaScript string conversion:
String(true) // 'true'
String(false) // 'false'
String(undefined) // 'undefined'
String(null) // 'null'
String(Infinity) // 'Infinity'
String(NaN) // 'NaN'
String({}) // '[object Object]'
String([]) // ''
String(function () {}) // 'function () {}'
String(Symbol('test')) // 'Symbol(test)'

// Default fallback is an empty string, but you can change it:
toString(undefined) // ''
toString(undefined, {elseReturn: 'N/A'}) // 'N/A'

// You can choose to throw an error for invalid inputs.
toString(undefined, {elseThrow: true}) // throws error

// String object => String
const stringObject = new String('test')
typeof stringObject // 'object'
typeof toString(stringObject) // 'string'
```

## Version Migration Guide

Here are backward-incompatible changes you need to know about.

### 2.x ⇒ 3.x

* The minimum supported Node version is now 8.3.0 (instead of 7.0.0).
* `toNumber` no lounger rounds the `elseReturn` value when `round` is `true`. If you need this behavior, apply `Math.round` to your `elseReturn` value manually.
* `toObject` will now throw an error if an entries array contains duplicate keys. In version 2, the last equivalent key would have silently overwritten the prior ones. You can restore the previous behavior by setting the new `throwIfEquivKeys` option to `false`.

### 1.x ⇒ 2.x

* `fallback` has been renamed to `elseReturn`.
* Use `elseThrow: true` instead of `fallback: null`.
* Unlike the old `fallback` parameter, `elseReturn` does _not_ type-enforce its values.
* `toObject` with `mirror: true` will now throw an error if any key would overwrite another key. In version 1, this would have been allowed.
* `toObject` with `mirror: true` will now allow an object to become an object key, so long as its string representation is not equivalent to that of any other key. In version 1, attempting to use an object as an object key would silently fail and would result in numeric index keys being used instead.
