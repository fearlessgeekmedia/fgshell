# copy-own

Copies an object’s own properties to another object.

“Own” properties are those that are not inherited from the prototype chain.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i copy-own
```

## API

The module exports a single function.

### Parameters

1. `from` (object): The source object that possesses the properties to be copied.
2. Optional: `to` (object): The destination object that should receive the copied properties. Defaults to a new object.
3. Optional: Object argument:
    * `enumOnly` (boolean): Whether or not to limit the copy operation to only those properties that were defined with the `enumerable` flag. Defaults to `false`.
    * `override` (boolean): If omitted or set to `true`, all properties will be copied (unless `overwrite` specifies otherwise). If set to `false`, then existing properties in `to` will be neither overwritten nor overridden; that is, the copy operation will only include properties that do not share a name with properties already existing in `to` or in its prototype chain.
    * `overwrite` (boolean): This property is only taken into consideration if `override` (see above) is omitted or set to `true`. If this property is also omitted or set to `true`, all properties will be copied (the default behavior). If set to `false`, then existing properties in `to` will _not_ be overwritten, but properties higher up in `to`’s prototype chain could still be overridden.

### Return Value

The function modifies the second argument (`to`) and returns it. If `to` is omitted, a new object is created and returned.

## Examples

```javascript
const copyOwn = require('copy-own')

const from = {a: 'from', b: 'from'}
const to = {b: 'to', c: 'to'}
const to = copyOwn(from, to)
to.a // 'from'
to.b // 'from'
to.c // 'to'
```

Here is the same example repeated with `overwrite` set to `false`:

```javascript
const copyOwn = require('copy-own')

const from = {a: 'from', b: 'from'}
const to = {b: 'to', c: 'to'}
const to = copyOwn(from, to, {overwrite: false})
to.a // 'from'
to.b // 'to'
to.c // 'to'
```

When no destination object is specified, a new object is created:

```javascript
const copyOwn = require('copy-own')

const from = {a: 1, b: 2}
const to = copyOwn(from)
to.a // 1
to.b // 2
```
