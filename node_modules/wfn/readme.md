# wfn

A module that prepares Wrapper Functions.

Ensures your wrapper has the same properties as the underlying function, such as `name` and `length`. When `toString()` is called on the wrapper function, the code of the original function is shown, together with a comment identifying the wrapper(s).

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i wfn
```

## API

The module exports a single function.

### Parameters

1. `fn` (Function): The underlying function
2. `wrapper` (Function): The wrapper function that calls `fn`

### Return Value

The modified `wrapper` function

## Usage

```javascript
const wfn = require('wfn')

function func (a, b, c) { return 'result' }
function wrapper () { return func() }

wrapper() // 'result'

// Before
wrapper.name // 'wrapper'
wrapper.length // 0
wrapper.toString() // 'function wrapper () { return func() }'

// Apply the module
wfn(func, wrapper)

// After
wrapper.name // 'func'
wrapper.length // 3
wrapper.toString() // 'function func (a, b, c) { return 'result' } /* [wfn] Wrapped with wrapper() */'
```

### Wrapper Function Stringification

In the above example, note that the wrapper’s `toString()` method produces the code of the underlying function — not of the wrapper — but with a comment notation that the function has been wrapped.

If you wrap a function more than once, `wfn` will recognize this and will generate a comment notation that mentions all the wrappers. Consider the following example:

```javascript
function original () {
  return 'value'
}

const wrapper1 = wfn(original, function wrapper1 () { return original() })
const wrapper2 = wfn(wrapper1, () => wrapper1())
const wrapper3 = wfn(wrapper2, function wrapper3 () { return wrapper2() })
```

If you call `wrapper3.toString()`, you will get the following:

```
function original () {
  /* [wfn] Wrapped with wrapper1(), wrapper3(), and 1 other unnamed function */
  return 'value'
}
```

If this is something you absolutely don’t care about, and you only want properties like `name` and `length` copied, consider swapping out this module for [`copy-own`](https://github.com/lamansky/copy-own) so you have less overhead.

## Related Modules

For more projects like this, check out the [xfn](https://github.com/lamansky/xfn) family of modules.
