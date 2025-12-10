# is-instance-of

Like [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), but uses class name strings. This means the module works cross-frame, [unlike `instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof$revision/1351859#instanceof_and_multiple_context_%28e.g._frames_or_windows%29).

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i is-instance-of
```

## API

The module exports a single function.

### Parameters

1. Bindable: `x` (object): The object that may or may not be an instance of the specified class(es).
2. `classes` (function, string, or array of functions/strings): Class names to look for in `x`’s prototype chain. (If one or more functions are provided, their names will be used, so that the check works cross-realm.)
3. Object argument:
    * Optional: `ci` (boolean): If `true`, class names will be compared case-insensitively. Defaults to `false`.

### Return Value

* `true` if `x` has any one of the `classes` in its prototype chain.
* `false` otherwise.

## Examples

```javascript
const isInstanceOf = require('is-instance-of')

isInstanceOf(new Date(), 'Date') // true
isInstanceOf(new Date(), Date) // true

// Case sensitivity / insensitivity
isInstanceOf(new Date(), 'date') // false
isInstanceOf(new Date(), 'date', {ci: true}) // true

// Only one class name needs to be matched for true to be returned
isInstanceOf(new Error(), ['Error', 'Date', RegExp]) // true

// Supports the bind operator
[]::isInstanceOf('Array') // true
```

## Nota Bene

This module’s strength is also its weakness. The module will consider `Date` in one frame/context to be equivalent to `Date` in another context, so long as they have the same name. The advantage of this approach is that this allows for cross-frame type checks. The disadvantage is that `Date` could be a completely different class in the other context and this module wouldn’t know the difference.

## Related

* [class-chain](https://github.com/lamansky/class-chain): Returns an object’s class and its ancestors.
* [isit](https://github.com/lamansky/isit): Tests a value’s type against a string like `'positive integer'` or `'non-empty map'`.
