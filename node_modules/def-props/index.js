'use strict'

const errate = require('errate')
const isIterable = require('is-iterable')
const isObjectBased = require('is-obj')
const typeError = require('type-error')

module.exports = function defProps (obj, props, {descDefaults, descs, throwIfEquivKeys: err} = {}) {
  if (!isIterable(props)) {
    if (isObjectBased(props)) {
      props = Object.entries(props)
      if (typeof descs === 'undefined') descs = true
    } else if (props) {
      throw typeError('an iterable or object', props)
    } else {
      return obj
    }
  }

  for (const entry of props) {
    if (!entry || typeof entry !== 'object') {
      throw new TypeError('Iterator value ' + String(entry) + ' is not an entry object')
    }
    const key = entry[0]
    const value = entry[1]
    if (err && Object.prototype.hasOwnProperty.call(obj, key)) {
      throw errate(err, TypeError, {forceClass: false, defaultMessage: 'Multiple keys have equivalent string representations and would overwrite each other in the generated object.'})
    }
    if (descs) {
      const desc = {...descDefaults, ...(typeof value === 'function' ? {value} : value)}
      if (typeof desc.get === 'function' || typeof desc.set === 'function') {
        delete desc.writable
        delete desc.value
      }
      Object.defineProperty(obj, key, desc)
    } else if (descDefaults) {
      Object.defineProperty(obj, key, {...descDefaults, value})
    } else {
      obj[key] = value
    }
  }
  return obj
}
