# otherwise

Executes fallback behavior if a function was unsuccessful. Intended for use in modules that use option object arguments.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i otherwise
```

## API

The module exports a single function.

### Parameters

1. Optional: Object argument:
    * `elseCall` (function): If provided, this function will be called with at least one argument: a function that will invoke the other fallbacks. (If `args` are specified, they will be provided as subsequent arguments.) If the function argument is not called, then `elseThrow` and `elseReturn` will not be taken into consideration, and the return value of the `elseCall` function will be forwarded.
    * `elseThrow` (Error or string): An error to be thrown. A string will be wrapped in an `Error` object automatically.
    * `elseReturn` (any): A value to return if `elseThrow` is omitted.
2. Optional: Object argument:
    * `defaultErrorClass` (Class): An Error class in which to wrap `elseThrow` if it is a string.
    * `args` (array): An array of arguments that should be passed on to `elseCall` if provided.

### Return Value

Returns the return value of `elseCall` (if provided) or returns `elseReturn`.
