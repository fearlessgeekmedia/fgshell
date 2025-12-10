# longest-first

Sorts items in descending order of length.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i longest-first
```

## API

The module exports a single function.

* **Parameter**: `items` (iterable): Values that should be sorted by their `length` property. (The original iterable is not modified.)
* **Return Value**: Array

## Example

```javascript
const longestFirst = require('longest-first')

longestFirst(['one', 'two', 'three']) // ['three', 'one', 'two']

// Supports the bind operator
['test', 'example']::longestFirst() // ['example', 'test']
```
