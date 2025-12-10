# plainify

Wraps a value in a plain object, if it isn’t one already.

Lets you specify a default single key for an options object, for example.

## Installation

Requires [Node.js](https://nodejs.org/) 4.0.0 or above.

```bash
npm i plainify
```

## API

The module exports a single function.

### Parameters

1. `key` (string or symbol): The key under which to file `x` if it’s not already a plain object.
2. `x` (any)

### Return Value

Returns `x` as-is if it’s a plain object. Otherwise, returns a new plain object with one entry, having `key` as the key and `x` as the value.

## Example

Let’s say you have an options object with keys `a`, `b`, and `c`. You can use `plainify` to specify `b` as the default key.

```javascript
const plainify = require('plainify')

function example (options) {
  const {a, b, c} = plainify('b', options)
  // ...
}

example({a: 1}) // a=1; b and c are undefined
example(2) // b=2; a and c are undefined
example() // a, b, and c are undefined
```

## Related

Inspired by [arrify](https://github.com/sindresorhus/arrify).
