# is-global-object

Returns true if a value is the `global` or `window` object of the current context.

## Installation

Requires [Node.js](https://nodejs.org/) 4.0.0 or above.

```bash
npm install is-global-object --save
```

The module exports a single function.

## Usage Example

```javascript
const isGlobalObject = require('is-global-object')

isGlobalObject(global) // true
isGlobalObject({}) // false
```
