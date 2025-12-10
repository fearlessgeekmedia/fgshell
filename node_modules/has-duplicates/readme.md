# has-duplicates

A [Node.js](https://nodejs.org/) module that checks an array for duplicate elements or a string for duplicate characters.

## Installation

```bash
npm install has-duplicates --save
```

## Usage

```javascript
const hasDuplicates = require('has-duplicates')

// Arrays
hasDuplicates([1, 1]) // true
hasDuplicates([1, 2]) // false

// Strings
hasDuplicates('aa') // true
hasDuplicates('ab') // false
```
