'use strict'

module.exports = function ffn (f, {blacklist} = {}) {
  const type = typeof f
  if (type === 'function') return f
  if (type === 'undefined') return blacklist ? x => !x : x => !!x
  if (Array.isArray(f)) return x => f.includes(x)
  return x => x === f
}
