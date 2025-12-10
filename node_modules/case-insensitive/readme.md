# case-insensitive

A [Node.js](https://nodejs.org/) module that wraps around an array or string and transforms certain methods into case-insensitive versions.

## Installation

```bash
npm install case-insensitive --save
```

The module exposes a single function.

## Usage

```javascript
const ci = require('case-insensitive')

ci('String').equals('STRING') // true
ci('String').startsWith('s') // true
ci('String').endsWith('nG') // true
ci('STRING').indexOf('t') // 1

ci(['Test']).equals(['test']) // true
ci(['A', 'B']).includes('A') // true
ci(['A', 'B']).indexOf('B') // 1
```

## Methods

The `ci()` function returns an object, with methods depending on the type of input:

| Method      | Arrays | Strings |
| ----------: | :----: | :-----: |
| endsWith    |        |    ✔    |
| equals      |   ✔    |    ✔    |
| includes    |   ✔    |    ✔    |
| indexOf     |   ✔    |    ✔    |
| lastIndexOf |   ✔    |    ✔    |
| startsWith  |        |    ✔    |
