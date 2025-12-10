# if-else-throw

If X, return Y, else throw Z.

X can be a boolean or a function.

## Installation

```bash
npm install if-else-throw --save
```

## Usage

```javascript
const ifElseThrow = require('if-else-throw')
let value

value = []
value = ifElseThrow(
  Array.isArray(value), // The boolean condition (in this case, true)
  value, // The value returned if true
  new TypeError('Not an array') // The error thrown if false
) // []

let value = 'totally not an array'
value = ifElseThrow(
  val => Array.isArray(val), // Instead of a boolean, can use a function
  value,
  new TypeError('Not an array')
) // Uncaught TypeError
```
