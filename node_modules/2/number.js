'use strict'

const otherwise = require('otherwise')
const roundTo = require('round-to')
const sbo = require('sbo')

const thousandsSepOnly = [' ', '\u2009', "'"]
const numberDigits = '0123456789'

const infinities = [
  ['infinity', '+infinity'],
  ['-infinity', '\u2212infinity'],
]
const suffixes = ['kg', 'm', 'b']

const stringToNumber = require('parser-factory')('main', {
  main ({char, consume, consumeRest, shift}, {userArgs: [{decimalComma, decimalPlacesInInt, ignoreBadChars} = {}]}) {
    let thousandsSep = ''
    let decimalSep = ''
    let decimals = ''
    let units = ''
    let group = ''
    let sign = 1

    let leftParen
    const rightParen = consume(')')

    for (const [i, s] of suffixes.entries()) {
      if (consume(...s)) {
        units = '000'.repeat(i + 1)
        break
      }
    }

    while (char()) {
      const sep = consume(',', '.', ...thousandsSepOnly)
      if (sep) {
        if (!decimals && !thousandsSep && !thousandsSepOnly.includes(sep)) {
          decimalSep = sep
          decimals = units
          units = ''
          group = ''
        } else if ((group.length !== 3 && !(group.length === 2 && units.length >= 5 && (units - 3) % 2 === 0)) || (thousandsSep && thousandsSep !== sep && !(thousandsSep === '.' && sep === ' ')) || (decimalSep && decimalSep === sep)) {
          if (!ignoreBadChars) return NaN
        } else {
          if (!thousandsSep) thousandsSep = sep
          group = ''
        }
      } else if (consumeRest('-', '\u2212')) {
        sign = -1
      } else if (rightParen && consumeRest('(')) {
        sign = -1
        leftParen = true
      } else {
        const n = shift(1)
        if (numberDigits.includes(n)) {
          units = n + units
          group = n + group
        } else if (!ignoreBadChars) {
          return NaN
        }
      }
    }

    if (!ignoreBadChars && rightParen && !leftParen) return NaN

    if (decimals.length === 3 && decimalSep && !thousandsSep && !decimalComma === (decimalSep === ',')) {
      units += decimals
      decimals = ''
    } else if (decimals) {
      if (decimalPlacesInInt > 0) {
        decimals = decimals.substr(0, decimalPlacesInInt).padEnd(2, '0')
      } else {
        decimals = '.' + decimals
      }
    }

    const n = units + decimals
    if (!n.length) return NaN
    return sign * Number(n)
  },
})

module.exports = sbo(function toNumber (x, {decimalComma, decimalPlacesInInt, elseCall, elseReturn = 0, elseThrow, finite = true, ignoreBadChars, round = false} = {}) {
  if (x instanceof String) x = String(x)
  if (typeof x === 'string') {
    x = x.toLowerCase()

    const testForInfinityString = positive => infinities[+!positive].some(
      ignoreBadChars ? inf => x.includes(inf) : inf => x === inf,
    )

    x = testForInfinityString(true) ? Infinity
      : testForInfinityString(false) ? -Infinity
        : stringToNumber(
          x.split('').reverse().join(''),
          {decimalComma, decimalPlacesInInt, ignoreBadChars},
        )
  } else if (x !== null) {
    x = Number(x)
  }
  if (x === null || Number.isNaN(x) || (finite && !Number.isFinite(x))) {
    return otherwise({elseCall, elseReturn, elseThrow}, {defaultErrorClass: TypeError})
  }
  if (!decimalPlacesInInt && (round || round === 0)) {
    return roundTo(x, round === true ? 0 : +round)
  }
  return x
})
