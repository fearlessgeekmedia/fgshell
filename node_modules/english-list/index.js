module.exports = function (conjunction, array, serialComma) {
  if (!Array.isArray(array) || !conjunction.toString) {
    throw new TypeError()
  }
  conjunction = conjunction.toString()
  serialComma = serialComma === undefined ? true : !!serialComma
  var length = array.length
  if (length === 0) {
    throw new Error('Cannot create an English list of an empty array')
  } else if (length === 1) {
    return array[0].toString()
  } else if (length === 2) {
    return (
      array[0].toString() +
      ' ' +
      conjunction +
      ' ' +
      array[1].toString()
    )
  } else {
    var strings = array.map(function (element) {
      return element.toString()
    })
    var front = strings.slice(0, length - 1)
    var last = strings[length - 1]
    return (
      front.join(', ') +
      (serialComma ? ', ' : ' ') +
      conjunction +
      ' ' +
      last
    )
  }
}
