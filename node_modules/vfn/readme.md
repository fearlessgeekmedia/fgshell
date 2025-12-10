# Variadic Function (vfn)

Lets you specify a “[rest parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters)” that’s _not_ at the end.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i vfn
```

## API

The module exports a single function.

### Parameters

1. Object argument (_or_ a value for `arg`):
    * Optional: `arg` (positive integer): The zero-based index of which parameter in `fn`’s parameters list should be the “rest parameter.” Defaults to `0`.
    * Optional: `oo` (boolean): If `true`, an optional options argument at the end of the parameter list will be ignored. (This will only work if you can be sure that none of your other arguments will be plain objects.) Defaults to `false`.
2. `fn` (function): The function that has a parameter you want to convert into a “rest parameter.”

### Return Value

A wrapper function that turns all excess arguments into an array which is passed to `fn` at parameter index `arg`.

## Example

JavaScript supports “rest parameters,” but only at the end. Anything else will throw an error:

```javascript
function func (...a, b, c) {} // Uncaught SyntaxError: Rest parameter must be last formal parameter
```

The `vfn` module lets you accomplish this. The index of `a` in the parameters list is `0`, so we pass `0` as the first argument to `vfn()`:

```javascript
const vfn = require('vfn')

const func = vfn(0, function (a, b, c) {})

func(1, 2, 3, 4, 5) // a = [1, 2, 3]; b = 4; c = 5
func(1, 2, 3) // a = [1]; b = 2; c = 3
func('test', 'example') // a = []; b = 'test'; c = 'example'
func('hello world') // a = []; b = 'hello world'; c = undefined
```

### With Optional Options Argument

Normally, `vfn` does not support optional parameters, because there’s no way to tell which arguments go to the optional parameter and which go to the variadic parameter. Therefore, `vfn` ignores optional parameters altogether. Take for example the common design pattern of including an optional options parameter at the end of the parameter list:

```javascript
const vfn = require('vfn')

const func = vfn(0, function (a, b, c, {option} = {}) {})

func(1, 2, 3, 4, 5) // a = [1, 2, 3]; b = 4; c = 5; option = undefined
func(1, 2, 3, 4, 5, {option: 123}) // a = [1, 2, 3, 4]; b = 5; c = {option: 123}; option = undefined
```

As you can see, the first call works as expected, because the optional options parameter is ignored completely. But it continues to be ignored when we introduce the options object in the second call. `vfn` collapses one too many arguments into `a` and puts the options object into `c`.

To make use of an optional options argument, set the `oo` flag when calling `vfn`:

```javascript
const vfn = require('vfn')

const func = vfn({arg: 0, oo: true}, function (a, b, c, {option} = {}) {})

func(1, 2, 3, 4, 5) // a = [1, 2, 3]; b = 4; c = 5; option = undefined
func(1, 2, 3, 4, 5, {option: 123}) // a = [1, 2, 3]; b = 4; c = 5; option = 123
```

With `oo` set, `vfn` will recognize that a plain object at the end belongs to an optional ending parameter.

This _only_ works if your options parameter is optional and is at the end, and if you can be sure that none of your other arguments will be plain objects.

## Related

For more projects like this, check out [@lamansky/fn](https://github.com/lamansky/fn).
