# empty-iterator

Creates an iterator that finishes immediately.

## Installation

Requires [Node.js](https://nodejs.org/) 4.0.0 or above.

```bash
npm i empty-iterator
```

## API

The module exports a single function with no parameters. Each time it is called, it creates and returns a new empty iterator.

## Example

```javascript
const emptyIterator = require('empty-iterator')

emptyIterator().next().done // true
```
