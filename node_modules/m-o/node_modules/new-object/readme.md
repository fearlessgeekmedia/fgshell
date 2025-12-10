# new-object

Creates an object from an array of entries.

The [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) constructor lets you specify initial keys and values via an `iterable` collection (e.g. an array) of key-value pairs, whereas the `Object` constructor does not. This simple module fills that gap, approximating [the ECMA-defined behavior for the Map constructor](https://tc39.github.io/ecma262/#sec-map-iterable) but for Objects.

In short, you can think of the `new-object` module as doing the opposite of [`Object.entries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries):

```JavaScript
newObject(Object.entries({a: 1, b: 2})) // {a: 1, b: 2}
```

Remember that, unlike Maps, Objects can only use strings and symbols as keys.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i new-object
```

## API

The module exports a single function.

### Parameters

1. `entries` (iterable): The key-value pairs for the object.
2. Optional: Object argument:
    * `throwIfEquivKeys` (Error, string, or boolean): Set this to throw an error if `entries` contains keys that would be considered duplicates in the context of an object. For example, a Map can have keys that are objects, but those keys will all likely evaluate to `[object Object]` if made keys in an object. Similarly, a Map can have distinct `1` (number) and `'1'` (string) keys, but these would be considered the same in an object context.

### Return Value

Returns a plain object containing `entries`.

## Example

```javascript
const newObject = require('new-object')

const entries = [['a', 1], ['b', 2]]

// What was possible for a Map...
const map = new Map(entries)
map.get('a') // 1

// ...is now also possible for an Object:
const obj = newObject(entries)
obj.a // 1
```

## Related

* [construct-map](https://github.com/lamansky/construct-map): Like this module, except it can also construct Maps and other key/value collections.
