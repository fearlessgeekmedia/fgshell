# Qualified Function (qfn)

Wraps a function so it only gets executed if a condition is true.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i qfn
```

## API

The module exports a single function.

### Parameters

1. Bindable: `fn` (function): The underlying function that may or may not get called, depending on `test`.
2. `test` (function or boolean): A boolean indicating whether `fn` should be called, or a function that returns such a boolean. If `test` is a function, it will be given all the arguments passed to the returned function.

### Return Value

A function which, when called, returns the return value of `fn`, if `test` is true. If `test` is false, the function returns the first argument passed to it.

## Example

```javascript
const qfn = require('qfn')

function add1 (x) {
  return x + 1
}

qfn(add1, true)(3) // 4
qfn(add1, false)(3) // 3

const add1IfEven = qfn(add1, x => x % 2 === 0)
add1IfEven(3) // 3
add1IfEven(4) // 5
```

## Related

For more projects like this, check out [@lamansky/fn](https://github.com/lamansky/fn).
