'use strict'

const arrify = require('arrify')
const errate = require('errate')
const roadblock = require('roadblock')

module.exports = ({fallback, elseCall, elseReturn = fallback, elseThrow} = {}, {defaultErrorClass, args} = {}) =>
  roadblock(elseCall, next => elseCall(next, ...arrify(args)), () => {
    if (elseThrow) throw errate(elseThrow, defaultErrorClass, {forceClass: false})
    return elseReturn
  })
