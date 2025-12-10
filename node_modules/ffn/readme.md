# ffn

Turns arrays and values into Filtering Functions.

Many projects use callbacks to filter values. Sometimes this filtering involves complex conditions that need a function. Other times one just wants to test if the value equals another, or if the value appears in an array of acceptable values. Instead of making your project’s end-users write filters like `x => x === 'value'` or `x => ['ok', 'also ok'].includes(x)`, let them provide the value or the array directly, and `ffn` will turn it into a filtering function.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i ffn
```

## API

The module exports a single function.

### Parameters

1. `f` (any): A Function, an Array, or some other value.
2. Object argument:
    * Optional: `blacklist` (bool): Set to `true` if `ffn` is being used to create a blacklist. This will make falsey values test true when `f` is undefined. Defaults to `false`.

### Return Values

* If `f` is a Function: returns `f`
* If `f` is omitted or otherwise undefined: returns a function that tests whether its argument is truthy (unless `blacklist` is `true`)
* If `f` is an Array: returns a function that tests whether its argument is included in `f`
* Otherwise: returns a function that tests whether its argument is strictly equal to `f`

## Example

```javascript
const ffn = require('ffn')

const arr = [1, 2, 3, 4, 5]

// ffn returns functions as-is
arr.find(ffn(x => x % 2 === 0)) // 2

// ffn creates a function which checks for inclusion in the array
arr.find(ffn([4, 5])) // 4

// ffn creates a function which checks for equality with the value
arr.find(ffn(3)) // 3
```

## Related

For more projects like this, check out the [xfn](https://github.com/lamansky/xfn) family of modules.
