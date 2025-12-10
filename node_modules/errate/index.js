'use strict'

const copyOwn = require('copy-own')
const isClassOf = require('is-class-of')
const is = require('is-instance-of')
const trimCall = require('trim-call')

module.exports = function errate (e, Cls = Error, {defaultMessage, forceClass = true} = {}) {
  if (isClassOf(e, 'Error')) {
    Cls = e
    e = null
  } else if (!isClassOf(Cls, 'Error')) {
    throw new TypeError('Invalid error class')
  }
  if (!e || e === true) return trimCall.new(Cls, defaultMessage)
  if (is(e, Cls)) return e
  if (is(e, 'Error')) return forceClass ? copyOwn(e, new Cls()) : e
  return new Cls(e)
}
