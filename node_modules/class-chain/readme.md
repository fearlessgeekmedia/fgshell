# class-chain

A [Node.js](https://nodejs.org/) module that returns an object’s class and its ancestors.

## Installation

```bash
npm install class-chain --save
```

## Usage

```javascript
const getClassChain = require('class-chain')

class A {}
class B extends A {}

let b = new B()

getClassChain(b) // [B, A]
getClassChain.names(b) // ['B', 'A']
```
