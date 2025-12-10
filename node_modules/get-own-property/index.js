'use strict'

module.exports = function getOwnProperty (obj, key) {
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
}
