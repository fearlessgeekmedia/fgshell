# def-props

Defines multiple object properties all at once, optionally with shared settings.

Read more about property descriptor settings at [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty).

## Installation

Requires [Node.js](https://nodejs.org/) 8.3.0 or above.

```bash
npm i def-props
```

## API

The module exports a single function.

### Parameters

1. `obj` (object): The object (or function) to which you want to add properties.
2. `props` (object): This must be one of the following:
    * An object whose keys are property names and whose values are property descriptors for the new object.
    * An array (or other iterable) of key-value pairs for the object.
    * An array (or other iterable) of key-descriptor pairs for the object’s properties (if `descs` is set to `true`).
2. Optional: Object argument:
    * `descDefaults` (plain object): A collection of descriptor settings (namely, `configurable`, `enumerable`, and/or `writable`) that will be applied to every property created on the new object. If you would like all these settings to be undefined, provide an empty object. Omit this option if you have specified complete descriptors in `props` or if you want the module to use simple assignment. If you provided property descriptors in `props`, the contents of `descDefaults` will serve as default values for those descriptors. If you specify `writable` in `descDefaults`, it will be skipped automatically for descriptors that contain getters or setters, since such descriptors cannot contain `writable`.
    * `descs` (boolean): Used to disambiguate the purpose of the values in `props`. If set to `true`, the values in `props` will be interpreted as property descriptor objects. If set to `false`, the values in `props` will be used as values for the new object. Defaults to `false` if `props` is an iterable; otherwise defaults to `true`.
    * `throwIfEquivKeys` (Error, string, or boolean): Only applies if `props` is an array. Set this to throw an error if a `props` array contains keys that would be considered duplicates in the context of an object. For example: a Map can have keys that are objects, but those keys will all likely evaluate to `[object Object]` and overwrite each other if made property keys in an object. Similarly, whereas a Map can have distinct `1` (number) and `'1'` (string) keys, these would be considered the same in an object context. If such a conflict exists and if this option is set to an Error object, the provided Error will be thrown as-is. An error message string will be used to construct a `TypeError`. A value of `true` will throw a `TypeError` with a default error message. A value of `false` is the same as the default behavior, which is that later equivalent keys will silently overwrite the earlier ones.

### Return Value

Returns the modified `obj`.

## Examples

### Object of Key-Descriptor Pairs

In this example, we define two getters on an object.

```javascript
const defProps = require('def-props')

const obj = {}
defProps(obj, {
  a: {get: () => 1},
  b: {get: () => 2},
})

obj.a // 1
obj.b // 2
```

### Supplementing Descriptors with Default Settings

Whenever you’re using the module in a property descriptor mode, you can specify settings to be applied to all property descriptors using `descDefaults`.

```javascript
const defProps = require('def-props')

const obj = {}
defProps(obj, {
  a: {get: () => 1}, // `writable` (below) will be ignored for this property
  b: {value: 2},
}, {
  descDefaults: {configurable: true, writable: true},
})
```

Since trying to set `writable` in a descriptor that also specifies a getter or setter will throw an error, the module will ignore the value of `writable` in `descDefaults` when creating the descriptor for a get/set property, such as the `a` property in the example above.

### Array of Key-Value Pairs

You can also use this module together with an entries array. For example, this snippet defines key-value pairs on an object as read-only properties.

```javascript
const defProps = require('def-props')

const obj = {}
defProps(
  obj,
  [['a', 1], ['b', 2]],
  {descDefaults: {writable: false}}
)

obj.a // 1
obj.b // 2

obj.a = 123 // TypeError: Cannot set property a of #<Object> which has only a getter
```

### Array of Key-Descriptor Pairs

In addition to providing an array of key-value pairs as in the two examples above, you can also provide an array of keys paired with object property descriptors, if `descs` is set to `true`.

```javascript
const defProps = require('def-props')

const obj = {}
defProps(
  obj,
  [
    ['a', {get: () => 1}],
    ['b', {get: () => 2}],
  ],
  {descs: true}
)

obj.a // 1
obj.b // 2

obj.a = 123 // TypeError: Cannot set property a of #<Object> which has only a getter
```

## Related

* [new-object](https://github.com/lamansky/new-object): Same as this module, but creates a new object instead of modifying an existing one.
