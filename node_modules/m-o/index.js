'use strict'

const getOwnProperty = require('get-own-property')
const ifElseThrow = require('if-else-throw')
const isObj = require('is-object')
const newObject = require('new-object')

const check = mo => ifElseThrow(isObj(mo), mo, new TypeError('m-o requires a Map or an Object'))
const isMap = mo => check(mo) instanceof Map

const has = (mo, key) => isMap(mo) ? mo.has(key) : Object.prototype.hasOwnProperty.call(mo, key)
const hasIn = (mo, key) => isMap(mo) ? mo.has(key) : key in mo
const get = (mo, key) => isMap(mo) ? mo.get(key) : getOwnProperty(mo, key)
const getIn = (mo, key) => isMap(mo) ? mo.get(key) : mo[key]
const set = (mo, key, val) => { if (isMap(mo)) mo.set(key, val); else mo[key] = val; return mo }
const edit = (mo, key, editor) => set(mo, key, editor(get(mo, key)))
const del = (mo, key) => isMap(mo) ? mo.delete(key) : has(mo, key) ? delete mo[key] : false
const construct = (Cls, entries = []) => Cls === Object ? newObject(entries) : new Cls(entries)
const reconstruct = (mo, entries = []) => isMap(mo) ? new (mo.constructor)(entries) : newObject(entries)
const entries = mo => isMap(mo) ? mo.entries() : Object.entries(mo)[Symbol.iterator]()
const entriesArray = mo => isMap(mo) ? Array.from(mo.entries()) : Object.entries(mo)
const keys = mo => isMap(mo) ? mo.keys() : Object.keys(mo)[Symbol.iterator]()
const keysArray = mo => isMap(mo) ? Array.from(mo.keys()) : Object.keys(mo)
const values = mo => isMap(mo) ? mo.values() : Object.values(mo)[Symbol.iterator]()
const valuesArray = mo => isMap(mo) ? Array.from(mo.values()) : Object.values(mo)

module.exports = {has, hasIn, get, getIn, set, edit, delete: del, construct, reconstruct, entries, entriesArray, keys, keysArray, values, valuesArray}
