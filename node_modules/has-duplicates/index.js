'use strict'

/**
 * Returns true if the array has duplicate elements or the string has
 * duplicate characters.
 * @param  {array|string} thing
 * @return {bool}
 */
module.exports = function hasDuplicates (thing) {
  return (new Set(thing)).size < thing.length
}
