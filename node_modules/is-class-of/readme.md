# is-class-of

Returns true if A is a subclass of B or the same class as B.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i is-class-of
```

## API

The module exports a single function.

### Parameters

1. Bindable: `A` (function): What may or may not be B or a subclass of B.
2. `B` (function or string): What may or may not be A or an ancestor of A. You can either provide the class itself or its string name.

### Return Value

* Returns `true` if `A` is a subclass of `B`, is equal to `B`, or has a name equal to `B`.
* Otherwise `false`.

## Example

```javascript
const isClassOf = require('is-class-of')

isClassOf(Date, Error) // false

isClassOf(Error, Error) // true
isClassOf(Error, 'Error') // true
isClassOf(TypeError, Error) // true
isClassOf(RangeError, Error) // true
isClassOf(RangeError, 'Error') // true

class A {}
class B extends A {}
isClassOf(A, A) // true
isClassOf(A, 'A') // true
isClassOf(B, A) // true
isClassOf(B, 'A') // true

// Supports the bind operator
Error::isClassOf(Error) // true
TypeError::isClassOf(Error) // true
TypeError::isClassOf('Error') // true
B::isClassOf(A) // true
```

## Related

* [is-subclass-of](https://github.com/lamansky/is-subclass-of): Returns true if A is a subclass of B.
* [is-instance-of](https://github.com/lamansky/is-instance-of): Like `instanceof`, but uses class name strings.
