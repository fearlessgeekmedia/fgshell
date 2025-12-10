# array-pad

Module for returning arrays with a specific length by padding values.

[![Build Status](https://travis-ci.org/tur-nr/node-array-pad.svg?branch=master)](https://travis-ci.org/tur-nr/node-array-pad)

### Example

```js
var pad = require('array-pad');
var arr = pad([], 3, null); // => [null, null, null] 
arr = pad(arr, 5, 0);       // => [null, null, null, 0, 0];
```

## Installation

### Node

To install `array-pad` in a Node application use npm.

```
$ npm install array-pad
```

### Browser

No tests available for the browser but you may try using it via [webpack](https://github.com/webpack/webpack).

```
$ webpack index.js array-pad.js
```

## Test

To run tests use npm.

```
$ npm install
$ npm test
```

## Documentation

### Basic Usage

Padding an `array` is simple as passing the desired `length` and an optional `value` to pad with. If no `value` is given, padded items will be set to `undefined` by default.

```js
var array = pad([], 2); // => [undefined, undefined]
pad(array, 4, null);    // => [undefined, undefined, null, null]
pad(array, 1, false);   // => [undefined, undefined, null, null]
```

### Pad Left

Pad, by default, pads `value`s to the right side of the `array` via the `.push()` method. To pad left, perform `.unshift()`, pass then `length` as a negative integer.

```js
pad([1,2,3], -5, 0); // => [0, 0, 1, 2, 3]
```

### Augmenting Array

Pad will always create a new instance of the `array` passed in. If augmentation to the original instance is required, pass the first parameter as `true`.

```js
var arr = [];
var res = pad(true, arr, 3);
res === arr; // => true
```

## API

#### pad(*[augment]*, *&lt;array&gt;*, *&lt;length&gt;*, *[value]*);

## License

[MIT](LICENSE)

Copyright (c) 2015 [Christopher Turner](https://github.com/tur-nr)
