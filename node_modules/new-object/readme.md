# new-object

Creates an Object from a collection of key-value pairs or key-descriptor pairs.

The [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) constructor lets you specify initial keys and values via an `iterable` collection (e.g. an array) of key-value pairs, whereas the `Object` constructor does not. This module fills that gap, approximating [the ECMA-defined behavior for the Map constructor](https://tc39.github.io/ecma262/#sec-map-iterable) but for Objects. (Remember that, unlike Maps, Objects can only use strings and symbols as keys.) In its simplest mode, you can think of the `new-object` module as doing the opposite of [`Object.entries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries):

```JavaScript
newObject(Object.entries({a: 1, b: 2})) // {a: 1, b: 2}
```

But in addition — since we’re working with Objects instead of Maps — `new-object` lets you customize the property definitions on the new object.

```JavaScript
newObject(Object.entries({a: 1, b: 2}), {descDefaults: {writable: false}}) // {a: 1, b: 2}
```

## Installation

Requires [Node.js](https://nodejs.org/) 8.3.0 or above.

```bash
npm i new-object
```

## API

The module exports a single function.

### Parameters

1. `entries` (iterable or other object): This must be one of the following:
    * An array (or other iterable) of key-value pairs for the object.
    * An array (or other iterable) of key-descriptor pairs for the object’s properties (if `descs` is set to `true`).
    * An object whose values are property descriptors for the new object.
2. Optional: Object argument:
    * `descDefaults` (plain object): A collection of descriptor settings (namely, `configurable`, `enumerable`, and/or `writable`) that will be applied to every property created on the new object. If you would like all these settings to be undefined, provide an empty object. Omit this option if you have specified complete descriptors in `entries` or if you want the module to use simple assignment. If you provided property descriptors in `entries`, the contents of `descDefaults` will serve as default values for those descriptors. If you specify `writable` in `descDefaults`, it will be automatically skipped for descriptors that contain getters or setters, since such descriptors cannot contain `writable`.
    * `descs` (boolean): Used to disambiguate the purpose of the values in `entries`. If set to `true`, the values in `entries` will be interpreted as property descriptor objects. If set to `false`, the values in `entries` will be used as values for the new object. Defaults to `false` if `entries` is an iterable; defaults to `true` if `entries` is a non-iterable object.
    * `throwIfEquivKeys` (Error, string, or boolean): Set this to throw an error if `entries` contains keys that would be considered duplicates in the context of an object. For example, a Map can have keys that are objects, but those keys will all likely evaluate to `[object Object]` and overwrite each other if made keys in an object. Similarly, a Map can have distinct `1` (number) and `'1'` (string) keys, but these would be considered the same in an object context. If such a conflict exists and if this option is set to an Error object, the provided Error will be thrown as-is. An error message string will be used to construct a `TypeError`. A value of `true` will throw a `TypeError` with a default error message. A value of `false` is the same as the default behavior, which is that later equivalent keys will silently overwrite the earlier ones.

### Return Value

Returns a plain object built with `entries`.

## Examples

### Array of Key-Value Pairs

This is the simplest use of the module, which is essentially performs the operation opposite that of [`Object.entries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries).

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

### Array of Key-Value Pairs With Global Descriptor Settings

This example creates the same object as above, but with read-only properties. Read more about property descriptor settings at [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty).

```javascript
const newObject = require('new-object')

const obj = newObject(
  [['a', 1], ['b', 2]],
  {descDefaults: {writable: false}}
)

obj.a // 1
obj.b // 2

obj.a = 123 // TypeError: Cannot set property a of #<Object> which has only a getter
```

### Array of Key-Descriptor Pairs

In addition to providing an array of key-value pairs as in the two examples above, you can also provide an array of keys paired with object property descriptors, if `descs` is set to `true`. Read more about property descriptor settings at [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty).

```javascript
const newObject = require('new-object')

const obj = newObject([
  ['a', {get: () => 1}],
  ['b', {get: () => 2}],
], {descs: true})

obj.a // 1
obj.b // 2

obj.a = 123 // TypeError: Cannot set property a of #<Object> which has only a getter
```

### Object of Key-Descriptor Pairs

You can also do the same as above but with an object. An object is presumed to contain descriptors (if it contains values, why do you need this module again?), so you don’t need to set `descs` to `true`.

```javascript
const newObject = require('new-object')

const obj = newObject({
  a: {get: () => 1},
  b: {get: () => 2},
})

obj.a // 1
obj.b // 2
```

### Supplementing Descriptors with Default Settings

Whenever you’re using the module in a property descriptor mode, you can specify settings to be applied to all property descriptors using `descDefaults`.

```javascript
const newObject = require('new-object')

const obj = newObject([
  ['a', {get: () => 1}], // `writable` (below) will be ignored for this property
  ['b', {value: 2}],
], {
  descs: true, // We have to specify this because the entries are in an array
  descDefaults: {configurable: true, writable: true},
})
```

Since trying to set `writable` in a descriptor that also specifies a getter or setter will throw an error, the module will ignore the value of `writable` in `descDefaults` when creating the descriptor for a get/set property, such as the `a` property in the example above.

## Version Migration Guide

Here are backward-incompatible changes you need to know about.

### 3.x ⇒ 4.x

* The minimum supported Node version is now 8.3.0 (instead of 6.0.0).

## Related

* [construct-map](https://github.com/lamansky/construct-map): Turns key-value pairs into a collection of the same type as another value, such as Map or Object.
* [def-props](https://github.com/lamansky/def-props): Same as this module, but modifies a existing object instead of creating a new one.
