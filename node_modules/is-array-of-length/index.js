'use strict'

const arrify = require('arrify')
const is = require('is-instance-of')

module.exports = require('sbo')((arr, lengths, {arrays} = {}) =>
  is(arr, [Array, arrays]) && arrify(lengths).some(len => arr.length === len))
