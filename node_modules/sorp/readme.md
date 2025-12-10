# sorp

Returns a singular or plural form depending on a given number.

Does not generate plural forms for you. There are plenty of other modules that do that. This module omits that overhead deliberately.

## Installation

Requires [Node.js](https://nodejs.org/) 4.0.0 or above.

```bash
npm i sorp
```

The module exports a single function.

## Usage Example

```javascript
const sorp = require('sorp')

sorp(0, 'thing', 'things') // 'things'
sorp(1, 'thing', 'things') // 'thing'
sorp(2, 'thing', 'things') // 'things'
```
