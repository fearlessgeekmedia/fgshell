# getOwnProperty

Retrieves a property only if [`hasOwnProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty) is true.

## Installation

```bash
npm install get-own-property --save
```

## Usage

```javascript
const getOwnProperty = require('get-own-property')

const obj = {hello: 'world'}

getOwnProperty(obj, 'hello') // 'world'

typeof obj.toString // 'function'
getOwnProperty(obj, 'toString') // undefined
```
