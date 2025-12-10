const {toString} = Object.prototype;
const vowels = /^[aeiou]/i;

const builtin = [Array, Boolean, Date, Error, Function, Number, Object, Promise, RegExp, String, Symbol];
if (typeof Buffer == 'function') builtin.push(Buffer);

const _TypeError = TypeError;
module.exports = function() {
  const cst = Error.captureStackTrace;
  return function TypeError(type, val) {
    if (type === undefined) throw Error('Type cannot be undefined');
    if (typeof type != 'string') type = ofType(type);
    const err = _TypeError('Expected ' + type + ', got ' + typeOf(val));
    if (cst) cst(err, TypeError);
    return err;
  };
}();

function typeOf(val) {
  if (val !== val) return 'NaN';
  return val == null || typeof val == 'boolean' ?
    String(val) : ofType(val.constructor);
}

function ofType(type) {
  if (type == null) type = Object;
  return article(type.name) +
    (builtin.indexOf(type) == -1 ?
      type.name + ' instance' :
      type.name.toLowerCase());
}

function article(str) {
  return vowels.test(str) ? 'an ' : 'a ';
}
