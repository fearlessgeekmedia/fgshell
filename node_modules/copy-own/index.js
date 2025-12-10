'use strict'

module.exports = function copyOwn (from, to = {}, {enumOnly, override = true, overwrite = true} = {}) {
  for (const key of (enumOnly ? Object.keys : Reflect.ownKeys)(from)) {
    if ((overwrite || !Object.prototype.hasOwnProperty.call(to, key)) && (override || !(key in to))) {
      Object.defineProperty(to, key, Object.getOwnPropertyDescriptor(from, key))
    }
  }
  return to
}
