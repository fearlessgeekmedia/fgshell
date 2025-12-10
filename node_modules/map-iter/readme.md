# map-iter

Applies a callback to each value outputted by an iterable.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i map-iter
```

## API

The module exports a single function.

### Parameters

1. `iter` (iterable)
2. `cb` (function): The callback that, for each value iterated by `iter`, will be given two arguments: the value iterated, and an incrementing index counter that starts at zero. The return value of `cb` will be iterated in lieu of the original value.

### Return Value

An iterator that outputs the return values of `cb`.

## Example

```javascript
const map = require('map-iter')

const iterator = map([1, 2, 3], x => x * 2)
iterator.next().value // 2
iterator.next().value // 4
iterator.next().value // 6
iterator.next().done // true
```

## Related

* [filter-iter](https://github.com/lamansky/filter-iter): Filters an iterable object so that it only yields values which pass a test function.
* [partition-iterable](https://github.com/lamansky/partition-iterable): Divides iterated values into those that match a filter and those that don’t.
* [reduce-iterable](https://github.com/lamansky/reduce-iterable): Applies a function to iterated values to reduce them to a single value.
* [unique-iterable](https://github.com/lamansky/unique-iterable): Filters an iterable object so it doesn’t yield the same value more than once.
* [unique-iterable-by](https://github.com/lamansky/unique-iterable-by): Filters yielded values by testing uniqueness with an index, key, or callback.
* [@lamansky/every](https://github.com/lamansky/every): Array.prototype.every() for iterables.
* [@lamansky/some](https://github.com/lamansky/some): Array.prototype.some() for iterables.
