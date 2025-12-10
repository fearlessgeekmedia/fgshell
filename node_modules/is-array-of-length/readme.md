# is-array-of-length

Returns true if a value is an array containing the specified number of elements.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i is-array-of-length
```

## API

The module exports a single function.

### Parameters

1. `arr` (any): What may or may not be an array
2. `lengths` (integer or array): One or more integers, each of which represents an acceptable number of items in the array.
3. Optional: Object argument:
    * `arrays` (class, string, or array): One or more classes or names of classes that should be treated as equivalent to `Array`.

### Return Values

* `true` if `arr` is an array with a length given in `lengths`
* `false` otherwise

## Example

```javascript
const isArrayOfLength = require('is-array-of-length')

isArrayOfLength(['a', 'b'], 2) // true
isArrayOfLength(['a', 'b'], 3) // false
isArrayOfLength(['a', 'b'], [2, 3]) // true
isArrayOfLength('7 chars', 7) // false

// Supports the bind operator
['a', 'b']::isArrayOfLength(2) // true
```
