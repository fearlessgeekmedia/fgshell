module.exports = function arrayPad(augment, array, length, value) {
  var total
    , method;

  // augment is optional
  if (typeof arguments[0] !== 'boolean') {
    value = length;
    length = array;
    array = augment;
    augment = false;
  }

  if (!Array.isArray(array)) {
    throw new TypeError('must be an array');
  }

  array = (augment) ? array : array.slice(0);
  method = (length < 0) ? 'unshift' : 'push';
  total = Math.abs(length);

  if (typeof length !== 'number' || (total % 1) !== 0) {
    throw new TypeError('length must be an integer');
  }

  while (array.length < total) {
    array[method](value);
  }

  return array;
};
