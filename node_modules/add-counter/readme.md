# add-counter

Adds a counter integer to iterated values.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i add-counter
```

## API

The module exports a single function.

### Parameters

1. `iter` (iterable): The underlying iterable.
2. Optional: `i` (integer): The starting value of the counter. Normally this would be either `0` or `1`. Defaults to `0`.

### Return Value

A generator that, for each iterated value `x`, yields `[i++, x]`

## Example

```javascript
const addCounter = require('add-counter')

for (const [i, x] of addCounter(['a', 'b', 'c'])) {
  // [0, 'a']
  // [1, 'b']
  // [2, 'c']
}
```
