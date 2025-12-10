Make "X, Y, and Z"-style lists from arrays.

```javascript
var list = require('english-list')
var assert = require('assert')

assert.equal(
  list('and', ['John']),
  'John'
)

assert.equal(
  list('and', ['John', 'Paul']),
  'John and Paul'
)

assert.equal(
  list('and', ['John', 'Paul', 'George']),
  'John, Paul, and George'
)

assert.equal(
  list('and', ['John', 'Paul', 'George'], false),
  'John, Paul and George'
)

assert.equal(
  list('and', ['John', 'Paul', 'George'], true),
  'John, Paul, and George'
)

assert.equal(
  list('or', ['John', 'Paul', 'George']),
  'John, Paul, or George'
)

assert.throws(function () {
  list('and', null)
}, TypeError)

assert.throws(function () {
  list('and', [])
}, Error)
```
