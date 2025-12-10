'use strict'

const errate = require('errate')

module.exports = function newObject (entries, {throwIfEquivKeys: err} = {}) {
  if (err === true) {
    err = new TypeError('Multiple keys have equivalent string representations and would overwrite each other in the generated object.')
  } else if (err) {
    err = errate(err, TypeError, {forceClass: false})
  }

  const obj = {}
  if (entries) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        throw new TypeError('Iterator value ' + String(entry) + ' is not an entry object')
      }
      if (err && (entry[0] in obj)) throw err
      obj[entry[0]] = entry[1]
    }
  }
  return obj
}
