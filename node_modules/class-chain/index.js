'use strict'

const isObject = require('is-object')

/**
 * Returns an object’s class and its ancestors.
 * @param  {object|function} obj The object or the first class in the chain.
 * @return {array.<function>} The class and the chain of classes it extends.
 */
function getClassChain (obj) {
  if (typeof obj === 'function') {
    if (!obj.name || obj === Object) return []
    return [obj].concat(getClassChain(Object.getPrototypeOf(obj)))
  }

  if (isObject(obj)) {
    return getClassChain(obj.constructor)
  }

  return []
}

/**
 * Returns the names of an object’s class and its ancestors.
 * @param  {object|function} obj The object or the first class in the chain.
 * @return {array.<string>} The names of the classes in the chain.
 */
getClassChain.names = function (obj) {
  return getClassChain(obj).map(cls => cls.name)
}

module.exports = getClassChain
