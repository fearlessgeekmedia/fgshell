# type-error v1.0.3

Create a native `TypeError` object by passing the expected type and the actual value.

*Note:* No validation is done; only type & value formatting.

```js
const TypeError = require('type-error');

const foo = new Foo();
if (!(foo instanceof Bar)) {
  throw TypeError(Bar, foo); // 'Expected a Bar instance, got a Foo instance'
}
```

The first argument should be the constructor of the expected type, or a string
describing the expected value. The second argument can be anything.

```js
TypeError(Function, 1)      // 'Expected a function, got a number'
TypeError(Array, true)      // 'Expected an array, got true'
TypeError(Number, NaN)      // 'Expected a number, got NaN'
TypeError('null', {})       // 'Expected null, got an object'
```
