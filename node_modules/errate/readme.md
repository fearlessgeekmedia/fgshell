# errate

Converts a value into an Error of the specified type.

## Installation

Requires [Node.js](https://nodejs.org/) 6.0.0 or above.

```bash
npm i errate
```

## API

The module exports a single function.

### Parameters

1. Optional: `e` (string, Error object, boolean, or null): The error message, or an existing Error object. If `null` or a boolean, the returned Error will have no message.
2. Optional: `Cls` (Error class): The desired class of the returned Error (such as `TypeError` or `RangeError`). Defaults to `Error`.
3. Optional: Object argument:
    * `defaultMessage` (string): The first argument that will be provided to the constructor if an Error object is being created (i.e. if `e` is `true` or “falsey”).
    * `forceClass` (boolean): If set to `true`, instances of other `Error` classes will be converted to instances of `Cls`. If set to `false`, `Cls` will only be used to wrap string errors. Defaults to `true`.

### Return Value

An Error of the specified class.

## Examples

### Default Class With Message

```javascript
const errate = require('errate')

const err = errate('Message')
err instanceof Error // true
err.message // 'Message'
```

### Default Class Without Message

```javascript
const errate = require('errate')

const err = errate()
err instanceof Error // true
err.message // ''
```

### Error Subclass With Message

```javascript
const errate = require('errate')

const err = errate('Message', TypeError)
err instanceof TypeError // true
err.message // 'Message'
```

### Error Subclass Without Message

```javascript
const errate = require('errate')

const err = errate(TypeError)
err instanceof TypeError // true
err.message // ''
```

### Error Class Conversion

```javascript
const errate = require('errate')

const err = errate(new TypeError('Message'), RangeError)
err instanceof RangeError // true
err.message // 'Message'
```
