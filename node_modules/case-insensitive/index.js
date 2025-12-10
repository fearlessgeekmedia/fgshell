'use strict'

const lowercaseValue = new WeakMap()

/**
 * Wraps around an array or string and transforms certain methods into case-insensitive versions.
 * @param  {array|string} thing
 * @return {object} A set of methods that all operate case-insensitively.
 */
module.exports = function ci (thing) {
  if (Array.isArray(thing)) {
    return new CaseInsensitiveArray(thing)
  } else if (typeof thing === 'string') {
    return new CaseInsensitiveString(thing)
  } else {
    throw new TypeError('`ci()` expects its argument to be an array or string.')
  }
}

function CaseInsensitiveArray (array) {
  if (!Array.isArray(array)) return
  this.original = array
  lowercaseValue.set(this, lowercaseArray(array))
}

CaseInsensitiveArray.prototype = {
  equals (needle) {
    return JSON.stringify(lowercaseValue.get(this)) === JSON.stringify(lowercaseArray(needle))
  },
  includes (needle) {
    return lowercaseValue.get(this).includes(lowercase(needle))
  },
  indexOf (needle) {
    return lowercaseValue.get(this).indexOf(lowercase(needle))
  },
  lastIndexOf (needle) {
    return lowercaseValue.get(this).lastIndexOf(lowercase(needle))
  },
}

function CaseInsensitiveString (string) {
  this.original = string
  lowercaseValue.set(this, lowercase(string))
}

CaseInsensitiveString.prototype = Object.create(CaseInsensitiveArray.prototype)

CaseInsensitiveString.prototype.toString = function () {
  return lowercaseValue.get(this)
}

CaseInsensitiveString.prototype.equals = function (needle) {
  return lowercaseValue.get(this) === lowercase(needle)
}

CaseInsensitiveString.prototype.endsWith = function (needle) {
  return lowercaseValue.get(this).endsWith(lowercase(needle))
}

CaseInsensitiveString.prototype.startsWith = function (needle) {
  return lowercaseValue.get(this).startsWith(lowercase(needle))
}

function lowercase (str) {
  return (str + '').toLowerCase()
}

function lowercaseArray (array) {
  return array.map(
    elem => typeof elem === 'string' ? lowercase(elem) : elem
  )
}
