'use strict'

module.exports = (shouldBlock, block, main) => shouldBlock ? block(main) : main()
