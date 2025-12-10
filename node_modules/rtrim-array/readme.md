# rtrim-array

Removes specified values from the end of an array. Analogous to a right-trim operation for strings, except this module tests array elements instead of string characters.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i rtrim-array
```

## API

The module exports a single function.

### Parameters

1. Bindable: `arr` (Array or Array-like): The array that might have ending elements to be removed.
2. Optional: `trim` (any): A Function that tests elements (returning `true` if the element should be trimmed), or an Array of elements to be trimmed, or any single value that should be trimmed. If this argument is omitted, then `undefined` will be trimmed.

### Return Value

A copy of `arr`, with any trimmable elements removed from the end.

## Examples

By default, `rtrimArray()` removes `undefined` elements from the end of an array.

```javascript
const rtrimArray = require('rtrim-array')
rtrimArray([1, 2, 3, undefined, undefined]) // [1, 2, 3]
```

This operation is distinct from that of `Array.prototype.filter()` because `rtrimArray()` only removes from the end. If a trimmable value (in this case, `undefined`) is found at the beginning or in the middle of the array, it will not be removed:

```javascript
rtrimArray([1, undefined, 3, undefined, undefined]) // [1, undefined, 3]
```

If you want to trim something besides `undefined`, provide it as the second argument:

```javascript
rtrimArray([1, 2, 3, undefined, null], null) // [1, 2, 3, undefined]
```

If you want more than one value to be trimmed, put the values in an array and provide it as the second argument:

```javascript
rtrimArray([1, 2, 3, null, false, null], [false, null]) // [1, 2, 3]
```

To do more advanced filtering, provide a callback. Each element on the end will be passed to the callback, and if the callback returns true, the element will be trimmed. If the callback returns false, the trimming will stop. In this example, the callback causes the module to trim numbers from the end, stopping when it reaches the string:

```javascript
rtrimArray([1, '2', 3, 4, 5], el => typeof el === 'number') // [1, '2']
```

If every element in the array is trimmable, an empty array will be returned:

```javascript
rtrimArray([undefined]) // []
```

The module also supports the bind operator:

```javascript
const rtrim = require('rtrim-array')
[1, 2, 3, undefined, undefined]::rtrim() // [1, 2, 3]
[1, 2, 3, undefined, null]::rtrim(null)  // [1, 2, 3, undefined]
```

## Related

* [ltrim-array](https://github.com/lamansky/ltrim-array): Removes specified values from the beginning of an array.
