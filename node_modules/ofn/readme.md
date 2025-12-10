# ofn

Overload a Function. Make parameters optional.

True overloading is not a feature of the JavaScript language, but the `ofn` module does give you one key feature of overloading: the ability to omit arguments at the beginning or in the middle of a function call.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i ofn
```

## API

The module exports a single function.

### Parameters

1. `argPrecedence` (Array): An array of unique integers ranging from 0 (inclusive) to `fn.length` (exclusive)
2. `fn` (Function): The function to be overloaded

### Return Value

A wrapper function that overloads the `fn` function based on the number of arguments with which it is called.

## Tutorial

JavaScript already lets you make parameters optional if they’re at the end:

```javascript
function example (a, b, c = 'default') {}
```

But let’s say you want both `a` and `b` to be optional, with default values of `1` and `2` respectively, and you want `b` to be the one omitted if there are only two arguments. Normally you’d see this implemented like so:

```javascript
function example (a, b, c) {
  if (arguments.length === 1) [a, b, c] = [1, 2, a]
  if (arguments.length === 2) [a, b, c] = [a, 2, b]
  // ...
}
```

Thankfully we have array destructuring in ES6 — things were a lot messier before that! But the `ofn` module makes things even easier and cleaner. With the `ofn` module, the above example would look like this:

```javascript
const ofn = require('ofn')
const example = ofn([2, 0, 1], (a = 1, b = 2, c) => {
  // ...
})
```

See the array passed as the first argument to `ofn`? That tells `ofn` the _precedence_ of the parameters. The number 2 comes first. That means if `example()` is called with only 1 argument, it’ll be given to the parameter with a (zero-based) index of 2, which is `c`. Calling `example('three')` will result in argument values of `1`, `2`, and `three`. The `a` and `b` arguments have nothing passed to them, so they keep their default values of `1` and `2`.

The number 0 is the second in the list. That means if there are two arguments, the arguments will be passed as the 0th and 2nd parameters, `a` and `c`, in that order. So calling `example('one', 'three')` means the function will receive argument values of `one`, `2`, and `three` respectively.

And finally, we have number 1 third. If there are three arguments, then the parameter with an index of 1 (which is `b`) will get included. `example('one', 'two', three')` will result in `one` for `a`, `two` for `b`, and `three` for `c`.

## Related Modules

For more projects like this, check out the [xfn](https://github.com/lamansky/xfn) family of modules.
