'use strict'

const copyOwn = require('copy-own')
const list = require('english-list')
const sorp = require('sorp')

const wrapperNames = new WeakMap()
const innerFnStrs = new WeakMap()

const multiLineFunction = /([^\n]+(?:\r?\n)?{\r?\n)([ \t]*)([\s\S]+)/

module.exports = function wrapFunction (fn, wrapper) {
  if (typeof fn !== 'function') throw new TypeError('wfn argument 1 must be a function')
  if (typeof wrapper !== 'function') throw new TypeError('wfn argument 2 must be a function')

  const innerFnStr = innerFnStrs.has(fn) ? innerFnStrs.get(fn) : String(fn)
  innerFnStrs.set(wrapper, innerFnStr)
  const names = (wrapperNames.has(fn) ? wrapperNames.get(fn) : []).concat([wrapper.name])
  wrapperNames.set(wrapper, names)

  copyOwn(fn, wrapper)

  const actualNames = names.filter(Boolean)
  let namesList
  if (actualNames.length) {
    const diff = names.length - actualNames.length
    namesList = list('and', actualNames.map(n => n + '()').concat(diff > 0 ? [diff + ' other unnamed function' + sorp(diff, '', 's')] : []))
  } else {
    namesList = names.length + ' unnamed function' + sorp(names.length, '', 's')
  }
  const comment = `/* [wfn] Wrapped with ${namesList} */`
  let fnStr
  const matches = innerFnStr.match(multiLineFunction)
  if (matches) {
    const [, before, space, after] = matches
    fnStr = before + space + comment + '\n' + space + after
  } else {
    fnStr = innerFnStr.trim() + '\n' + comment
  }
  wrapper.toString = () => fnStr

  return wrapper
}
